// Run only against the isolated extended-test database, before and after restart.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const base=process.env.NCHEF_QA_URL;
assert.equal(base,'http://127.0.0.1:8891');
const file='.wrangler/extended-qa-persistence.json';
const canonical=value=>Array.isArray(value)?value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):value && typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
async function state(username){
 const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username,password:'qa-only-password-2026'})});
 assert.equal(login.status,200);
 const response=await fetch(base+'/api/state',{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}});
 assert.equal(response.status,200);
 return canonical(await response.json());
}
const current={};
for(const username of ['qa_admin','qa_purchaser','qa_exec','qa_head'])current[username]=await state(username);
if(process.argv[2]==='snapshot'){
 assert.ok(current.qa_admin.stockHistory.length>0);
 assert.ok(current.qa_admin.operationRecords.some(row=>row.kind==='delivery'));
 writeFileSync(file,JSON.stringify(current));
 console.log('Saved four-role persistence baseline with requests, approvals, orders, balances, delivery outcomes and history.');
}else{
 assert.equal(process.argv[2],'verify');
 assert.deepEqual(current,JSON.parse(readFileSync(file,'utf8')));
 console.log('Restart persistence passed: all four role projections, business records, stock balances, histories and revision match exactly.');
}
