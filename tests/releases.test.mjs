import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { version, checkCandidate, checkSchema, checkRecord, checkBindings, migrationDigest, singleVersion, smoke, publish, rollback } from '../scripts/lib/releases.mjs';
import { requireCurrentClient, releaseInfo } from '../worker/release.mjs';
const config={accountId:'account',workerName:'api',pagesProject:'site',databaseId:'db',productionUrl:'https://example.test'};
const schema={epoch:'stock-v1',migrations:[{name:'0001.sql',sha256:'first'}]};
const info={version:'1.0.0',commit:'a'.repeat(40),dirty:false,schema};
const old={workerVersionId:'11111111-1111-4111-8111-111111111111',pagesDeploymentId:'22222222-2222-4222-8222-222222222222'};
const next={workerVersionId:'33333333-3333-4333-8333-333333333333',pagesDeploymentId:'44444444-4444-4444-8444-444444444444'};
const record=()=>({format:1,status:'healthy',release:info,schema,target:{...config,...old}});
function operations(override={}) {
  const calls=[],writes=[];
  return {calls,writes,
    snapshot:async()=>({target:old,release:null,migrationNames:['0001.sql']}),
    write:async(name,value)=>writes.push([name,structuredClone(value)]),
    smoke:async info=>calls.push(['smoke',info]),
    deployWorker:async()=>{calls.push(['worker']);return next.workerVersionId;},
    deployPages:async()=>{calls.push(['pages']);return next.pagesDeploymentId;},
    verify:async target=>calls.push(['verify',target]),
    checkTargets:async target=>calls.push(['targets',target]),
    restoreWorker:async id=>calls.push(['restoreWorker',id]),
    restorePages:async id=>calls.push(['restorePages',id]),...override};
}
test('stable versions require matching lock/package version and committed production provenance',()=>{
  assert.equal(version('v1.0.0'),'1.0.0');assert.equal(version('2.12.1'),'2.12.1');
  for(const value of ['1.0','01.0.0','1.0.0-rc.1','v1.0.0\n','v1.0.0\nBAD=1','$(bad)'])assert.throws(()=>version(value));
  checkCandidate(info,'v1.0.0');assert.throws(()=>checkCandidate({...info,dirty:true},'1.0.0'));assert.throws(()=>checkCandidate(info,'1.1.0'));
});
test('schema guards stop code rollback across migrations, modified files and compatibility epochs',()=>{
  checkSchema(schema,['0001.sql'],schema);
  assert.throws(()=>checkSchema(schema,['0001.sql','0002.sql'],schema));
  assert.throws(()=>checkSchema(schema,[],schema));
  assert.throws(()=>checkSchema(schema,['0001.sql'],{...schema,epoch:'stock-v2'}));
  assert.throws(()=>checkSchema(schema,['0001.sql'],{...schema,migrations:[{name:'0001.sql',sha256:'changed'}]}));
  assert.equal(migrationDigest('SELECT 1;\r\n'),migrationDigest('SELECT 1;\n'));
});
test('only healthy records for this exact environment and fixed deployment pair can be restored',()=>{
  checkRecord(record(),config);
  for(const bad of [{...record(),status:'failed'},{...record(),target:{...record().target,databaseId:'other'}},{...record(),target:{...record().target,workerVersionId:'latest'}}])assert.throws(()=>checkRecord(bad,config));
  assert.throws(()=>singleVersion({deployments:[{versions:[{version_id:'one',percentage:50},{version_id:'two',percentage:50}]}]}));
});
test('publish records the previous pair first and marks success only after pair and smoke checks',async()=>{
  const ops=operations();const result=await publish(info,config,ops);
  assert.equal(result.status,'healthy');assert.deepEqual(result.target,{...config,...next});
  assert.equal(ops.writes[0][0],'before.json');assert.equal(ops.writes[0][1].status,'healthy');
  assert.deepEqual(ops.calls.map(c=>c[0]),['smoke','worker','pages','verify','smoke']);
  assert.equal(ops.writes.at(-1)[1].status,'healthy');
});
test('frontend deployment failure preserves recovery IDs and never advertises a healthy release',async()=>{
  const ops=operations({deployPages:async()=>{throw Error('Upload failed');}});
  await assert.rejects(publish(info,config,ops),/before.json/);
  const failure=ops.writes.at(-1)[1];assert.equal(failure.status,'failed');assert.equal(failure.target.workerVersionId,next.workerVersionId);assert.ok(ops.writes.find(w=>w[0]==='before.json'));
});

test('recovery snapshots preserve the previous release schema after maintenance migrations',async()=>{
  const updated={epoch:schema.epoch,migrations:[...schema.migrations,{name:'0002.sql',sha256:'second'}]};
  const ops=operations({snapshot:async()=>({target:old,release:info,schema,migrationNames:['0001.sql','0002.sql']})});
  await publish({...info,schema:updated},config,ops);
  const previous=ops.writes.find(w=>w[0]==='before.json')[1];
  assert.deepEqual(previous.schema,schema);
  const recovery=operations({snapshot:async()=>({target:next,migrationNames:['0001.sql','0002.sql']})});
  await assert.rejects(rollback(previous,config,updated,recovery),/migrations differ/);
  assert.equal(recovery.calls.length,0);
});
test('schema mismatch or missing rollback target makes zero production mutations',async()=>{
  const ops=operations({snapshot:async()=>({target:old,migrationNames:['0001.sql','0002.sql']})});
  await assert.rejects(rollback(record(),config,schema,ops),/migrations differ/);assert.equal(ops.calls.length,0);
  const missing=operations({checkTargets:async()=>{throw Error('Target deleted');}});
  await assert.rejects(rollback(record(),config,schema,missing),/Target deleted/);assert.ok(!missing.calls.some(c=>c[0].startsWith('restore')));
});
test('rollback restores both recorded components and keeps a precise partial-failure journal',async()=>{
  const ops=operations();await rollback(record(),config,schema,ops);
  assert.deepEqual(ops.calls.map(c=>c[0]),['targets','restoreWorker','restorePages','verify','smoke']);
  const bad=operations({restorePages:async()=>{throw Error('Pages unavailable');}});
  await assert.rejects(rollback(record(),config,schema,bad),/Rollback incomplete/);
  assert.equal(bad.writes.at(-1)[1].workerRestored,true);assert.equal(bad.writes.at(-1)[1].pagesRestored,undefined);assert.equal(bad.writes.at(-1)[1].status,'failed');
});
test('rollback can recover an unhealthy current app and refuses targets bound to different resources',async()=>{
  const ops=operations({snapshot:async options=>{assert.equal(options.allowUnhealthy,true);return {target:next,release:null,migrationNames:['0001.sql']};}});
  await rollback(record(),config,schema,ops);assert.ok(ops.calls.some(c=>c[0]==='restoreWorker'));
  const worker={resources:{bindings:[{type:'d1',name:'DB',database_id:'db'}]}};
  const page={environment:'production',latest_stage:{status:'success'},services:{API:{service:'api',environment:''}}};
  checkBindings(worker,page,config);
  assert.throws(()=>checkBindings(worker,{...page,environment:'preview'},config));
  assert.throws(()=>checkBindings(worker,{...page,services:{API:{service:'other'}}},config));
  assert.throws(()=>checkBindings({resources:{bindings:[]}},page,config));
});
test('smoke checks require matching frontend and backend commits and versions',async()=>{
  const good=async url=>new Response(JSON.stringify(url.endsWith('/health')?{ok:true,release:info}:info));
  await smoke(good,'https://example.test',info,1);
  const mismatch=async url=>new Response(JSON.stringify(url.endsWith('/health')?{ok:true,release:info}:{...info,commit:'b'.repeat(40)}));
  await assert.rejects(smoke(mismatch,'https://example.test',info,1),/do not match/);
});
test('older or missing browser release IDs cannot write after deploy or rollback; reads/login remain available',()=>{
  const env={NCHEF_RELEASE_COMMIT:info.commit,NCHEF_RELEASE_VERSION:'1.0.0'};
  const post=commit=>new Request('https://example.test/api/changes',{method:'POST',headers:commit?{'X-NCHEF-Client-Release':commit}:{}});
  assert.throws(()=>requireCurrentClient(post(),env,'/api/changes'),e=>e.status===409);
  assert.throws(()=>requireCurrentClient(post('old'),env,'/api/purchase-orders/raise'),e=>e.status===409);
  requireCurrentClient(post(info.commit),env,'/api/stock/receipt');
  requireCurrentClient(post(),env,'/api/login');requireCurrentClient(new Request('https://example.test/api/state'),env,'/api/state');requireCurrentClient(post(),{},'/api/changes');
  assert.equal(releaseInfo(env).version,'1.0.0');
});
test('release and rollback are manual, serialized, and never call database restore or migrations apply',()=>{
  for(const file of ['release','rollback']) {
    const source=readFileSync(`.github/workflows/${file}.yml`,'utf8');assert.ok(source.includes('workflow_dispatch:'));assert.ok(!source.includes('  push:'));assert.ok(source.includes('group: nchef-production-release'));assert.ok(source.includes('cancel-in-progress: false'));
  }
  const cli=readFileSync('scripts/release.mjs','utf8');assert.ok(!cli.includes("'migrations','apply'"));assert.ok(!cli.includes('time-travel'));assert.ok(cli.includes('WRANGLER_OUTPUT_FILE_PATH'));
});
