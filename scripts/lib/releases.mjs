import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export const fail = message => { throw new Error(message); };
export function version(value) {
  if (typeof value!=='string' || /\s/.test(value) || !/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) fail('Use a stable semantic version, for example v1.0.0.');
  return value.replace(/^v/, '');
}
export const digest = value => createHash('sha256').update(value).digest('hex');
export const migrationDigest = value => digest(value.toString().replace(/\r\n/g,'\n'));
export function metadata(root = process.cwd()) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json')));
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json')));
  if (pkg.version !== lock.version || pkg.version !== lock.packages[''].version) fail('package.json and package-lock.json versions differ.');
  const config = JSON.parse(readFileSync(resolve(root, 'release.config.json')));
  const migrations = readdirSync(resolve(root, 'migrations')).filter(f=>f.endsWith('.sql')).sort().map(name=>({name,sha256:migrationDigest(readFileSync(resolve(root,'migrations',name)))}));
  if(JSON.stringify(migrations)!==JSON.stringify(JSON.parse(readFileSync(resolve(root,'migrations.lock.json')))))fail('Migration checksums differ from migrations.lock.json. Never edit an existing migration.');
  let commit = 'development', dirty = true;
  try {
    commit = execFileSync('git', ['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    dirty = !!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
  } catch { /* A development build outside Git is never a production candidate. */ }
  return {version:version(pkg.version),commit,dirty,builtAt:new Date().toISOString(),schema:{epoch:config.databaseEpoch,migrations}};
}
export function checkCandidate(info, requested) {
  if (info.version !== version(requested)) fail('Requested release does not match package.json. Bump and merge the version first.');
  if (info.dirty || !/^[a-f0-9]{40}$/.test(info.commit)) fail('Production releases require a clean, committed checkout.');
}
export function checkSchema(schema, names, currentSchema) {
  if (schema.epoch !== currentSchema.epoch) fail('Database compatibility epoch differs. Use a coordinated maintenance recovery or forward fix.');
  const expected=schema.migrations.map(m=>m.name).sort();
  if (JSON.stringify(expected)!==JSON.stringify([...names].sort())) fail('Database migrations differ from this release. Automatic schema changes and database rollback are disabled.');
  for(const file of schema.migrations) {
    if(currentSchema.migrations.find(m=>m.name===file.name)?.sha256!==file.sha256) fail('A migration checksum differs. Existing migration files must remain immutable.');
  }
}
const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || '');
export function checkRecord(record, config) {
  if(record.format!==1 || record.status!=='healthy' || !record.schema?.migrations?.length) fail('Choose a healthy release.json or its before.json recovery snapshot.');
  if(!record.target || !uuid(record.target.workerVersionId) || !uuid(record.target.pagesDeploymentId)) fail('The rollback record lacks exact deployment identifiers.');
  for(const key of ['accountId','workerName','pagesProject','databaseId','productionUrl'])if(record.target[key]!==config[key])fail('Rollback record targets a different project or environment.');
  if(record.release && (!/^[a-f0-9]{40}$/.test(record.release.commit) || !record.release.version))fail('Invalid release provenance.');
}
export function singleVersion(result) {
  const active=result.deployments?.[0];
  if(active?.versions?.length!==1 || active.versions[0].percentage!==100)fail('Expected one Worker version serving 100% of traffic. Finish any gradual rollout first.');
  return active.versions[0].version_id;
}
export function checkBindings(worker, page, config) {
  const database=worker.resources?.bindings?.find(b=>b.type==='d1' && b.name==='DB');
  if((database?.database_id || database?.id)!==config.databaseId)fail('Worker version is bound to a different database.');
  if(page.environment!=='production' || page.latest_stage?.status!=='success')fail('Choose a successful production Pages deployment, not a preview.');
  if(page.services?.API?.service!==config.workerName || page.services.API.environment)fail('Pages deployment targets a different API service or environment.');
}
export async function smoke(fetcher, url, expected, attempts=6) {
  let last;
  for(let i=0;i<attempts;i++) {
    try {
      const h=await fetcher(url+'/api/health',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      const health=await h.json();
      if(!h.ok || health.ok!==true)fail('API health check failed.');
      if(expected) {
        const r=await fetcher(url+'/release.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
        const frontend=await r.json();
        if(!r.ok || frontend.commit!==expected.commit || frontend.version!==expected.version || health.release?.commit!==expected.commit || health.release?.version!==expected.version)fail('Frontend/API release versions do not match the selected release.');
      }
      return health;
    } catch(error) {last=error;if(i<attempts-1)await new Promise(resolve=>setTimeout(resolve,2000));}
  }
  throw last;
}
// Dependency injection keeps failure/partial-rollout tests entirely off production.
export async function publish(info, config, ops) {
  const before=await ops.snapshot();
  checkSchema(info.schema,before.migrationNames,info.schema);
  await ops.smoke(before.release);
  await ops.write('before.json',{format:1,status:'healthy',release:before.release || null,schema:before.schema || info.schema,target:{...config,...before.target}});
  const record={format:1,status:'in-progress',release:info,schema:info.schema,target:{...config},previous:before.target,startedAt:new Date().toISOString()};
  await ops.write('release.json',record);
  try {
    record.target.workerVersionId=await ops.deployWorker(info);
    await ops.write('release.json',record);
    record.target.pagesDeploymentId=await ops.deployPages(info);
    await ops.write('release.json',record);
    await ops.verify(record.target);
    await ops.smoke(info);
    record.status='healthy';record.finishedAt=new Date().toISOString();
    await ops.write('release.json',record);
    return record;
  } catch(error) {
    record.status='failed';record.error=error.message;await ops.write('release.json',record);
    throw new Error('Release failed: '+error.message+'. Use the saved before.json snapshot for coordinated recovery. No database restore was attempted.');
  }
}
export async function rollback(record, config, currentSchema, ops) {
  checkRecord(record,config);
  const before=await ops.snapshot({allowUnhealthy:true});
  checkSchema(record.schema,before.migrationNames,currentSchema);
  await ops.checkTargets(record.target); // Verify both targets exist before changing either component.
  const journal={format:1,status:'in-progress',target:record.target,previous:before.target,startedAt:new Date().toISOString()};
  await ops.write('rollback.json',journal);
  try {
    await ops.restoreWorker(record.target.workerVersionId);
    journal.workerRestored=true;await ops.write('rollback.json',journal);
    await ops.restorePages(record.target.pagesDeploymentId);
    journal.pagesRestored=true;await ops.write('rollback.json',journal);
    await ops.verify(record.target);
    await ops.smoke(record.release);
    journal.status='healthy';journal.finishedAt=new Date().toISOString();await ops.write('rollback.json',journal);
    return journal;
  } catch(error) {
    journal.status='failed';journal.error=error.message;await ops.write('rollback.json',journal);
    throw new Error('Rollback incomplete: '+error.message+'. Check rollback.json for the exact components restored. Database records were not changed.');
  }
}
