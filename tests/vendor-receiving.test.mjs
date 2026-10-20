import {test} from 'node:test';import assert from 'node:assert/strict';import {planVendorReceipt} from '../worker/purchase-orders.mjs';
const actor={id:'p',role:'purchaser',name:'Purchaser',assignedLocations:['a']};
const fixture=()=>({vendors:[{id:'v',name:'Vendor'}],purchase_orders:[{id:'po',poNumber:'PO-1',outletId:'a',vendorId:'v',items:[{itemId:'rice',itemName:'Rice',qty:10}],status:'PO Raised'}]});
test('partial quality rejection receives only usable stock and retains the shortfall',()=>{
 const state=fixture();const result=planVendorReceipt(state,actor,{poId:'po',lines:[{itemId:'rice',receivedQuantity:8,rejectedQuantity:2,unitPrice:12.5,reason:'Quality issues'}]});
 assert.equal(result.receipts[0].quantity,8);assert.equal(result.po.items[0].receivedQty,8);assert.equal(result.po.items[0].rejectedQty,2);assert.equal(result.po.status,'Partially Received');assert.equal(result.event.lines[0].totalCostMinor,10000);assert.equal(state.purchase_orders[0].items[0].receivedQty,undefined);
 const rest=planVendorReceipt({...state,purchase_orders:[result.po]},actor,{poId:'po',lines:[{itemId:'rice',receivedQuantity:2,rejectedQuantity:0,unitPrice:13}]});assert.equal(rest.po.status,'Received');assert.equal(rest.po.items[0].receivedQty,10);assert.equal(rest.po.receiptEvents.length,2);
});
test('fully rejected goods need no price, create no stock receipt and retain the full order',()=>{
 const result=planVendorReceipt(fixture(),actor,{poId:'po',lines:[{itemId:'rice',receivedQuantity:0,rejectedQuantity:10,reason:'Other',message:'Wrong temperature'}]});assert.equal(result.receipts.length,0);assert.equal(result.po.items[0].receivedQty,0);assert.equal(result.po.status,'Partially Received');
});
test('receiving rejects excess, invalid costs, duplicate items, missing reason and unauthorized users',()=>{
 const row={itemId:'rice',receivedQuantity:5,rejectedQuantity:0,unitPrice:2};
 for(const patch of [{receivedQuantity:11},{rejectedQuantity:6},{unitPrice:1.111},{unitPrice:undefined},{rejectedQuantity:1},{rejectedQuantity:1,reason:'Other',message:''}])assert.throws(()=>planVendorReceipt(fixture(),actor,{poId:'po',lines:[{...row,...patch}]}));
 assert.throws(()=>planVendorReceipt(fixture(),actor,{poId:'po',lines:[row,row]}));assert.throws(()=>planVendorReceipt(fixture(),{...actor,role:'cuisine_head'},{poId:'po',lines:[row]}));assert.throws(()=>planVendorReceipt(fixture(),{...actor,assignedLocations:['b']},{poId:'po',lines:[row]}));
});

test('received is accepted stock and rejection is not subtracted a second time',()=>{
 const result=planVendorReceipt(fixture(),actor,{poId:'po',lines:[{itemId:'rice',receivedQuantity:1,rejectedQuantity:1,unitPrice:100,reason:'Quality issues'}]});
 assert.equal(result.receipts[0].quantity,1);assert.equal(result.event.lines[0].acceptedQuantity,1);assert.equal(result.event.lines[0].totalCostMinor,10000);assert.equal(result.po.items[0].receivedQty,1);
});
