import {test} from 'node:test';
import assert from 'node:assert/strict';
import {operationCommand, reviewChefRequests, notifyIssuedDeliveries, clearHandledNotifications} from '../worker/operations.mjs';
import {planVendorReceipt} from '../worker/purchase-orders.mjs';

const head={id:'head',role:'cuisine_head',name:'Head',assignedLocations:['a'],assignedSections:['Indian']};
const exec={id:'exec',role:'executive_chef',name:'Executive Chef',assignedLocations:['a']};
const delivery=(id,status='Issued')=>({id,kind:'delivery',status,outletId:'a',cuisine:'Indian',recipientId:'head',quantity:3,itemName:'Rice',unit:'kg',createdAt:new Date().toISOString()});
const fixture=()=>({users:[head,exec,{...head,id:'other'}],outlets:[{id:'a'}],operationRecords:[],requests:[],indents:[],purchase_orders:[]});

test('bulk delivery acceptance preserves issues and rejects unauthorized or stale batches',()=>{
 const state=fixture();state.operationRecords=[delivery('one'),delivery('two'),delivery('issue','Issue reported')];
 const result=operationCommand(state,head,{ids:['one','two']},'deliveries/accept-all');
 assert.equal(result.next.operationRecords[0].receivedQuantity,3);
 assert.equal(result.next.operationRecords[1].status,'Received');
 assert.equal(result.next.operationRecords[2].status,'Issue reported');
 assert.equal(state.operationRecords[0].status,'Issued');
 assert.throws(()=>operationCommand(state,{...head,id:'other'},{ids:['one']},'deliveries/accept-all'),/access denied/);
 assert.throws(()=>operationCommand(state,head,{ids:['one','issue']},'deliveries/accept-all'),/already been handled/);
 assert.throws(()=>operationCommand(state,exec,{ids:['one']},'deliveries/accept-all'),/permission/);
});

test('issued notifications target the requesting head, deduplicate and clear on confirmation',()=>{
 const state=fixture();state.operationRecords=[delivery('one')];
 notifyIssuedDeliveries(state,[delivery('one')]);notifyIssuedDeliveries(state,[delivery('one')]);
 const notices=state.operationRecords.filter(r=>r.kind==='notification');
 assert.equal(notices.length,1);assert.equal(notices[0].userId,'head');assert.equal(notices[0].sourceId,'one');
 const result=operationCommand(state,head,{ids:['one']},'deliveries/accept-all');
 clearHandledNotifications(state,result.next,head);
 assert.equal(result.next.operationRecords.find(r=>r.kind==='notification').read,true);
});

test('executive rejection requires a reason, preserves the request and notifies its owner',()=>{
 const state=fixture();state.requests=[{id:'r',ownerId:'head',status:'Pending',outletId:'a',itemName:'Rice',qty:3}];
 assert.throws(()=>operationCommand(state,exec,{id:'r',reason:' '},'requests/reject'),/reason/i);
 const result=operationCommand(state,exec,{id:'r',reason:'Quantity needs correction'},'requests/reject');
 assert.equal(result.changes[0].value.status,'Rejected');
 assert.equal(result.changes[0].value.rejectReason,'Quantity needs correction');
 assert.equal(result.next.operationRecords[0].userId,'head');
 assert.equal(state.requests[0].status,'Pending');
});

test('review accepts revised quantities and reopens a rejected consolidated request together',()=>{
 const state=fixture();state.indents=[{id:'indent',ownerId:'exec',status:'Rejected',outletId:'a'}];
 state.requests=['one','two'].map(id=>({id,status:'Rejected',qty:3,outletId:'a',indentId:'indent'}));
 const lines=state.requests.map(r=>({id:r.id,quantity:2,expectedQuantity:3,expectedStatus:'Rejected'}));
 assert.throws(()=>reviewChefRequests(state,exec,{lines:lines.slice(0,1)}),/all items/);
 const result=reviewChefRequests(state,exec,{lines});
 assert.equal(result.changes[0].value.revisedQty,2);assert.equal(result.changes[0].value.status,'Accepted');
 assert.equal(result.changes[0].value.indentId,undefined);
 assert.equal(result.changes.at(-1).value,null);
 assert.throws(()=>reviewChefRequests(state,exec,{lines:[{...lines[0],expectedQuantity:9}]}),/changed/);
});

test('invoice comparison uses accepted stock only and supports optional or invalid invoice totals',()=>{
 const state={vendors:[{id:'vendor',name:'Vendor'}],purchase_orders:[{id:'po',outletId:'a',vendorId:'vendor',poNumber:'PO-1',status:'PO Raised',items:[{itemId:'rice',itemName:'Rice',qty:10}]}]};
 const actor={id:'p',role:'purchaser',assignedLocations:['a']};
 const input={poId:'po',vendorInvoiceTotal:120,lines:[{itemId:'rice',receivedQuantity:8,rejectedQuantity:2,unitPrice:12.5,reason:'Quality issues'}]};
 const {event}=planVendorReceipt(state,actor,input);
 assert.equal(event.stockTotalMinor,10000);assert.equal(event.vendorInvoiceTotalMinor,12000);assert.equal(event.invoiceDifferenceMinor,2000);
 assert.equal(planVendorReceipt(state,actor,{...input,vendorInvoiceTotal:undefined}).event.vendorInvoiceTotalMinor,undefined);
 assert.throws(()=>planVendorReceipt(state,actor,{...input,vendorInvoiceTotal:-1}),/valid/);
});
