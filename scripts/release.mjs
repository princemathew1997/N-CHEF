import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { metadata, version, checkCandidate, checkRecord, checkSchema, checkBindings, singleVersion, smoke, publish, rollback, fail } from './lib/releases.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const [command,...args]=process.argv.slice(2);
const options={};
for(let i=0;i<args.length;i++) {
  const name=args[i];
  if(name==='--execute')options.execute=true;
  else if(name==='--remote')options.remote=true;
  else if(['--version','--manifest'].includes(name) && args[i+1] && !args[i+1].startsWith('--'))options[name.slice(2)]=args[++i];
  else fail('Unknown or incomplete release option: '+name);
}
const config=JSON.parse(readFileSync('release.config.json'));
const info=metadata(root);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const run=(program,args,extra={})=>{
  const result=spawnSync(program,args,{cwd:root,stdio:'inherit',env:{...process.env,...extra}});
  if(result.error)throw result.error;if(result.status!==0)fail('Command failed: '+program+' '+args.join(' '));
};
const wrangler=(args,extra)=>run(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...args],extra);
const recordDir=resolve('dist/releases');
function write(name,data){mkdirSync(recordDir,{recursive:true});writeFileSync(resolve(recordDir,name),JSON.stringify(data,null,2)+'\n');}
async function cf(method,path,body) {
  if(!process.env.CLOUDFLARE_API_TOKEN)fail('CLOUDFLARE_API_TOKEN is required. Never put its value in a command argument.');
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+config.accountId+path,{method,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
  const data=await response.json();
  if(!response.ok || !data.success)fail('Cloudflare '+method+' '+path+' failed: '+(data.errors?.map(e=>e.message).join('; ') || response.status));
  return data.result;
}
const pagesPath='/pages/projects/'+config.pagesProject;
const workerPath='/workers/scripts/'+config.workerName;
async function snapshot({allowUnhealthy=false}={}) {
  const [project,deployments,db]=await Promise.all([
    cf('GET',pagesPath), cf('GET',workerPath+'/deployments'),
    cf('POST','/d1/database/'+config.databaseId+'/query',{sql:'SELECT name FROM d1_migrations ORDER BY name'})
  ]);
  if(project.source && project.source.config?.production_deployments_enabled!==false && project.source.config?.deployments_enabled!==false)fail('Disable Pages automatic production builds before using manual releases.');
  if(project.production_branch!==config.productionBranch)fail('Pages production branch does not match release.config.json.');
  const canonical=project.canonical_deployment;
  if(!canonical?.id || canonical.latest_stage?.status!=='success')fail('There is no successful current Pages production deployment to recover to.');
  const workerVersionId=singleVersion(deployments);
  const [workerVersion,page]=await Promise.all([cf('GET',workerPath+'/versions/'+workerVersionId),cf('GET',pagesPath+'/deployments/'+canonical.id)]);
  if(!allowUnhealthy)checkBindings(workerVersion,page,config);
  let health;
  try{health=await smoke(fetch,config.productionUrl,null,allowUnhealthy?1:6);}catch(error){if(!allowUnhealthy)throw error;health={ok:false};}
  const release=/^[a-f0-9]{40}$/.test(health.release?.commit || '')?health.release:null;
  let schema;
  if(release && !allowUnhealthy) {
    const response=await fetch(config.productionUrl+'/release.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    const frontend=await response.json();
    if(!response.ok || frontend.commit!==release.commit || frontend.version!==release.version || !frontend.schema?.migrations?.length || frontend.schema.epoch!==release.databaseEpoch)fail('Current frontend/API schema provenance does not match. Resolve the existing deployment before publishing.');
    schema=frontend.schema;
  }
  return {target:{workerVersionId,pagesDeploymentId:canonical.id,pagesCommit:canonical.deployment_trigger?.metadata?.commit_hash || null},release,schema,migrationNames:db[0].results.map(r=>r.name)};
}
function output(name,type) {
  const rows=readFileSync(resolve(recordDir,name),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  const result=rows.filter(row=>row.type===type).at(-1);if(!result)fail('Wrangler did not emit a '+type+' deployment identifier.');return result;
}
async function verify(target) {
  for(let i=0;i<6;i++) {
    const [project,deployments]=await Promise.all([cf('GET',pagesPath),cf('GET',workerPath+'/deployments')]);
    if(project.canonical_deployment?.id===target.pagesDeploymentId && singleVersion(deployments)===target.workerVersionId){await checkTargets(target);return;}
    if(i<5)await new Promise(resolve=>setTimeout(resolve,2000));
  }
  fail('The production deployment pair differs from the recorded target.');
}
async function checkTargets(target) {
  const [page,worker]=await Promise.all([cf('GET',pagesPath+'/deployments/'+target.pagesDeploymentId),cf('GET',workerPath+'/versions/'+target.workerVersionId)]);
  checkBindings(worker,page,config);
}
const ops={snapshot,write,verify,checkTargets,smoke:expected=>smoke(fetch,config.productionUrl,expected),
  deployWorker:async info=>{
    console.log('Deploying API for v'+info.version);
    wrangler(['deploy','--keep-vars','--tag','v'+info.version,'--message','N-CHEF v'+info.version+' '+info.commit,'--var','NCHEF_RELEASE_VERSION:'+info.version,'--var','NCHEF_RELEASE_COMMIT:'+info.commit],{WRANGLER_OUTPUT_FILE_PATH:resolve(recordDir,'worker-output.jsonl')});
    const result=output('worker-output.jsonl','deploy');
    if(result.worker_name!==config.workerName)fail('Wrangler deployed a different Worker.');return result.version_id;
  },
  deployPages:async info=>{
    console.log('Deploying frontend for v'+info.version);
    wrangler(['pages','deploy','--cwd',resolve('pages'),'--project-name',config.pagesProject,'--branch',config.productionBranch,'--commit-hash',info.commit,'--commit-message','N-CHEF v'+info.version,'--commit-dirty=false'],{CLOUDFLARE_ACCOUNT_ID:config.accountId,WRANGLER_OUTPUT_FILE_PATH:resolve(recordDir,'pages-output.jsonl')});
    const result=output('pages-output.jsonl','pages-deploy-detailed');
    if(result.pages_project!==config.pagesProject || result.environment!=='production' || result.deployment_trigger.metadata.commit_hash!==info.commit)fail('Pages deployment provenance does not match the release.');return result.deployment_id;
  },
  restoreWorker:id=>cf('POST',workerPath+'/deployments',{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':'Manual N-CHEF coordinated rollback'}}),
  restorePages:id=>cf('POST',pagesPath+'/deployments/'+id+'/rollback')
};
try {
  // Do not allow a renamed local config to silently retarget production.
  const worker=JSON.parse(readFileSync('wrangler.jsonc')),pages=JSON.parse(readFileSync('pages/wrangler.jsonc'));
  if(worker.account_id!==config.accountId || worker.name!==config.workerName || worker.d1_databases.find(d=>d.binding==='DB')?.database_id!==config.databaseId || pages.name!==config.pagesProject || pages.services.find(s=>s.binding==='API')?.service!==config.workerName)fail('Wrangler and release target configuration differ.');
  if(command==='check') {
    if(options.version)checkCandidate(info,options.version);
    console.log(JSON.stringify(info,null,2));
    if(options.remote){const current=await snapshot();checkSchema(info.schema,current.migrationNames,info.schema);await ops.smoke(current.release);console.log('Production preflight passed. No deployments or database changes were made.');}
  } else if(command==='deploy') {
    checkCandidate(info,options.version);
    if(info.commit!==git('rev-parse','origin/'+config.productionBranch))fail('Only the fetched main commit can be released. Fetch origin and merge the version change first.');
    if(!options.execute)console.log(JSON.stringify({action:'publish',release:info,target:config,execute:false},null,2));
    else {
      if(!process.env.npm_execpath)fail('Run this command through npm run release:deploy.');
      run(process.execPath,[resolve('scripts/check-migrations.mjs')]);
      run(process.execPath,[process.env.npm_execpath,'test']);
      run(process.execPath,[process.env.npm_execpath,'run','test:database']);
      run(process.execPath,[resolve('scripts/build.mjs')]);
      wrangler(['deploy','--dry-run','--outdir','dist/worker']);
      const built=JSON.parse(readFileSync('dist/pages/release.json'));
      if(built.commit!==info.commit || built.dirty)fail('Build provenance changed during validation.');
      write('operation.json',{action:'publish',version:info.version,commit:info.commit,startedAt:new Date().toISOString()});
      await publish(info,config,ops);
      console.log('Healthy release recorded in dist/releases/release.json');
    }
  } else if(command==='rollback') {
    if(!options.manifest)fail('Pass --manifest path/to/release.json (or before.json for recovery).');
    const target=JSON.parse(readFileSync(resolve(options.manifest)));
    checkRecord(target,config);
    if(target.release && options.version && version(target.release.version)!==version(options.version))fail('Requested version does not match the rollback manifest.');
    if(options.version && target.release && git('rev-parse','v'+version(options.version)+'^{commit}')!==target.release.commit)fail('Release record commit differs from the immutable Git tag.');
    if(!options.execute)console.log(JSON.stringify({action:'rollback',target:target.target,version:target.release?.version || 'pre-versioning snapshot',execute:false,databaseRestored:false},null,2));
    else {
      if(info.dirty)fail('Use a clean checkout for production rollback.');
      await rollback(target,config,info.schema,ops);
      console.log('Rollback verified. Database transactions were preserved.');
    }
  } else fail('Use check, deploy --version v1.0.0 [--execute], or rollback --manifest file [--execute].');
} catch(error) {console.error(error.message);process.exitCode=1;}
