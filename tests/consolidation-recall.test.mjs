import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recallConsolidatedRequest} from '../worker/operations.mjs';
const actor={id:'exec',role:'executive_chef',name:'Executive',assignedLocations:['a']};
const fixture=()=>({users:[actor],requests:[{id:'r',indentId:'i',status:'Consolidated',ownerId:'chef',qty:3}],indents:[{id:'i',ownerId:'exec',outletId:'a',status:'Pending Approval',indentNumber:'REQ-1',items:[]}],purchase_orders:[],operationRecords:[]});
test('recall immediately returns existing requests to accepted and snapshots the old indent',()=>{
 const state=fixture();const result=recallConsolidatedRequest(state,actor,{id:'i'});
 assert.equal(result.changes[0].value.status,'Accepted');assert.equal(result.changes[0].value.indentId,undefined);assert.equal(result.changes[0].value.ownerId,'chef');
 assert.equal(result.changes[1].value,null);assert.equal(result.next.operationRecords.find(r=>r.eventType==='indent_recall').indent.indentNumber,'REQ-1');
 assert.equal(state.requests[0].status,'Consolidated');
});
test('recall blocks approved orders, purchases, wrong owners and other outlets',()=>{
 const approved=fixture();approved.indents[0].status='Approved';assert.throws(()=>recallConsolidatedRequest(approved,actor,{id:'i'}));
 const purchased=fixture();purchased.purchase_orders=[{indentId:'i'}];assert.throws(()=>recallConsolidatedRequest(purchased,actor,{id:'i'}));
 assert.throws(()=>recallConsolidatedRequest(fixture(),{...actor,id:'other'},{id:'i'}));
 assert.throws(()=>recallConsolidatedRequest(fixture(),{...actor,assignedLocations:['b']},{id:'i'}));
});
