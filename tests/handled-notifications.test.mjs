import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clearHandledNotifications,operationCommand} from '../worker/operations.mjs';
test('handling an approval clears existing alerts for all recipients',()=>{
 const previous={requests:[],indents:[{id:'i',status:'Pending Approval'}],operationRecords:[{id:'n1',kind:'notification',sourceId:'i',userId:'a',read:false},{id:'n2',kind:'notification',sourceId:'i',userId:'p',read:false},{id:'other',kind:'notification',sourceId:'other',read:false}]};
 const next=structuredClone(previous);next.indents[0].status='Approved';
 clearHandledNotifications(previous,next,{id:'a'});
 assert.equal(next.operationRecords[0].read,true);assert.equal(next.operationRecords[1].read,true);assert.equal(next.operationRecords[2].read,false);
});
test('account and delivery resolution clears old alerts but preserves newly generated outcome messages',()=>{
 for(const [kind,status] of [['account_request','Approved'],['delivery','Resolved']]){
  const previous={operationRecords:[{id:'source',kind,status:'Pending'},{id:'old',kind:'notification',sourceId:'source',read:false}]};
  const next=structuredClone(previous);next.operationRecords[0].status=status;next.operationRecords.push({id:'outcome',kind:'notification',sourceId:'source',read:false});
  clearHandledNotifications(previous,next,{id:'actor'});
  assert.equal(next.operationRecords[1].read,true);assert.equal(next.operationRecords[2].read,false);
 }
});
test('failed or unchanged actions leave notifications unread',()=>{
 const state={indents:[{id:'i',status:'Pending Approval'}],operationRecords:[{id:'n',kind:'notification',sourceId:'i',read:false}]};
 const next=structuredClone(state);clearHandledNotifications(state,next,{id:'actor'});assert.equal(next.operationRecords[0].read,false);
});

test('mark all read changes only the signed-in user notifications',()=>{
 const state={operationRecords:[{id:'mine',kind:'notification',userId:'a',read:false},{id:'read',kind:'notification',userId:'a',read:true},{id:'other',kind:'notification',userId:'b',read:false},{id:'internal',kind:'notification',system:true,read:false}]};
 const result=operationCommand(state,{id:'a'}, {},'notifications/read-all');
 assert.equal(result.next.operationRecords.find(r=>r.id==='mine').read,true);
 assert.equal(result.next.operationRecords.find(r=>r.id==='other').read,false);
 assert.equal(result.next.operationRecords.find(r=>r.id==='internal').read,false);
 assert.equal(state.operationRecords[0].read,false);
 assert.deepEqual(operationCommand(result.next,{id:'a'}, {},'notifications/read-all').next,result.next);
});
