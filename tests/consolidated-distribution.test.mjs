import {test} from 'node:test';import assert from 'node:assert/strict';import {operationCommand} from '../worker/operations.mjs';
const actor={id:'p',role:'purchaser',assignedLocations:['a']};
const fixture=()=>({users:[],outlets:[{id:'a'}],items:[{id:'rice',name:'Rice',unit:'kg'}],outletStock:[{item_id:'rice',outlet_id:'a',quantity:28}],indents:[{id:'i',status:'Approved',outletId:'a'}],requests:[{id:'r',indentId:'i',itemId:'rice',outletId:'a',cuisine:'Indian',status:'Approved',qty:5,approvedQuantity:4}],operationRecords:[]});
test('distribution is linked to the consolidated order and changed quantities need a comment',()=>{
 const calls=[];const state=fixture();assert.throws(()=>operationCommand(state,actor,{indentId:'i',lines:[{requestId:'r',quantity:2}]},'distribution/issue',(...args)=>calls.push(args)));assert.equal(calls.length,0);
 const result=operationCommand(state,actor,{indentId:'i',lines:[{requestId:'r',quantity:2,comment:'Only two available'}]},'distribution/issue',(...args)=>calls.push(args));assert.equal(calls.length,1);assert.equal(calls[0][1].requestId,'r');assert.equal(calls[0][1].reason,'Only two available');assert.equal(result.next.operationRecords[0].eventType,'consolidated_distribution');
});
test('distribution checks total outlet stock before staging any issue',()=>{
 const state=fixture();
 state.requests[0].approvedQuantity=100;
 state.outletStock.push({item_id:'rice',outlet_id:'b',quantity:100});
 const calls=[];
 const issue=lines=>operationCommand(state,actor,{indentId:'i',lines},'distribution/issue',(...args)=>calls.push(args));
 const insufficient=error=>error.status===409 && error.message.includes('Available: 28 kg');
 assert.throws(()=>issue([{requestId:'r',quantity:100}]),insufficient);
 state.requests.push({...state.requests[0],id:'r2',cuisine:'Chinese'});
 const line=(requestId,quantity)=>({requestId,quantity,comment:'Partial issue'});
 assert.throws(()=>issue([line('r',20),line('r2',9)]),insufficient);
 assert.equal(calls.length,0);
 issue([line('r',20),line('r2',8)]);
 assert.deepEqual(calls.map(([,input])=>input.quantity),[20,8]);
});
test('distribution rejects wrong roles, outlets, unapproved parents and quantities above remaining approval',()=>{
 const input={indentId:'i',lines:[{requestId:'r',quantity:4}]};
 assert.throws(()=>operationCommand(fixture(),{...actor,role:'cuisine_head'},input,'distribution/issue',()=>{}));assert.throws(()=>operationCommand(fixture(),{...actor,assignedLocations:['b']},input,'distribution/issue',()=>{}));
 const state=fixture();state.indents[0].status='Pending Approval';assert.throws(()=>operationCommand(state,actor,input,'distribution/issue',()=>{}));
 assert.throws(()=>operationCommand(fixture(),actor,{...input,lines:[{requestId:'r',quantity:5,comment:'Extra'}]},'distribution/issue',()=>{}));
 const issued=fixture();issued.operationRecords=[{kind:'delivery',requestId:'r',quantity:3}];assert.throws(()=>operationCommand(issued,actor,input,'distribution/issue',()=>{}));
});
