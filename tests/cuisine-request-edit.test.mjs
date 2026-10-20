import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editCuisineRequest} from '../worker/operations.mjs';
const actor={id:'chef',name:'Chef',role:'cuisine_head',assignedLocations:['a']};
const fixture=()=>({users:[actor],operationRecords:[],requests:[{id:'r',ownerId:'chef',itemId:'rice',itemName:'Rice',outletId:'a',cuisine:'Indian',qty:2,status:'Pending'}],indents:[]});
test('cuisine head can edit their pending request without mutating the source',()=>{
 const state=fixture();const result=editCuisineRequest(state,actor,{id:'r',quantity:4});
 assert.equal(result.changes[0].value.qty,4);assert.equal(state.requests[0].qty,2);
});
test('consolidated requests remain locked before approval; additional quantities require a fresh request',()=>{
 const state=fixture();Object.assign(state.requests[0],{status:'Consolidated',indentId:'i'});
 state.indents=[{id:'i',status:'Pending Approval',items:[{itemId:'rice',originalQty:2,revisedQty:2}]}];
 assert.throws(()=>editCuisineRequest(state,actor,{id:'r',quantity:4}),e=>e.status===409);
 assert.equal(state.requests[0].qty,2);assert.equal(state.indents[0].items[0].revisedQty,2);
});
test('Executive Chef acceptance immediately locks Cuisine Head edits',()=>{
 const state=fixture();state.requests[0].status='Accepted';
 assert.throws(()=>editCuisineRequest(state,actor,{id:'r',quantity:4}),e=>e.status===409);
 assert.equal(state.requests[0].qty,2);
});
test('edits reject other owners, other outlets, approved orders and invalid quantities',()=>{
 for(const quantity of [0,-1,NaN,Infinity])assert.throws(()=>editCuisineRequest(fixture(),actor,{id:'r',quantity}));
 for(const status of ['Accepted','Approved','PO Raised','Rejected','Consolidated','Sent to Admin']){const state=fixture();state.requests[0].status=status;assert.throws(()=>editCuisineRequest(state,actor,{id:'r',quantity:4}));}
 assert.throws(()=>editCuisineRequest(fixture(),{...actor,id:'stranger'},{id:'r',quantity:4}));
 assert.throws(()=>editCuisineRequest(fixture(),{...actor,assignedLocations:['b']},{id:'r',quantity:4}));
 const state=fixture();Object.assign(state.requests[0],{status:'Consolidated',indentId:'i'});state.indents=[{id:'i',status:'Approved'}];assert.throws(()=>editCuisineRequest(state,actor,{id:'r',quantity:4}));
});
