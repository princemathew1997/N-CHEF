import {test} from 'node:test';import assert from 'node:assert/strict';import {operationCommand} from '../worker/operations.mjs';
const actor={id:'p',role:'purchaser',assignedLocations:['a']};
const fixture=()=>({users:[],outlets:[{id:'a'}],indents:[{id:'i',status:'Approved',outletId:'a'}],requests:[{id:'r',indentId:'i',itemId:'rice',outletId:'a',cuisine:'Indian',status:'Approved',qty:5,approvedQuantity:4}],operationRecords:[]});
test('distribution is linked to the consolidated order and changed quantities need a comment',()=>{
 const calls=[];const state=fixture();assert.throws(()=>operationCommand(state,actor,{indentId:'i',lines:[{requestId:'r',quantity:2}]},'distribution/issue',(...args)=>calls.push(args)));assert.equal(calls.length,0);
 const result=operationCommand(state,actor,{indentId:'i',lines:[{requestId:'r',quantity:2,comment:'Only two available'}]},'distribution/issue',(...args)=>calls.push(args));assert.equal(calls.length,1);assert.equal(calls[0][1].requestId,'r');assert.equal(calls[0][1].reason,'Only two available');assert.equal(result.next.operationRecords[0].eventType,'consolidated_distribution');
});
test('distribution rejects wrong roles, outlets, unapproved parents and quantities above remaining approval',()=>{
 const input={indentId:'i',lines:[{requestId:'r',quantity:4}]};
 assert.throws(()=>operationCommand(fixture(),{...actor,role:'cuisine_head'},input,'distribution/issue',()=>{}));assert.throws(()=>operationCommand(fixture(),{...actor,assignedLocations:['b']},input,'distribution/issue',()=>{}));
 const state=fixture();state.indents[0].status='Pending Approval';assert.throws(()=>operationCommand(state,actor,input,'distribution/issue',()=>{}));
 assert.throws(()=>operationCommand(fixture(),actor,{...input,lines:[{requestId:'r',quantity:5,comment:'Extra'}]},'distribution/issue',()=>{}));
 const issued=fixture();issued.operationRecords=[{kind:'delivery',requestId:'r',quantity:3}];assert.throws(()=>operationCommand(issued,actor,input,'distribution/issue',()=>{}));
});
