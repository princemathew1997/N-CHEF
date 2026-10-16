import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { raiseVendorOrders } from '../worker/purchase-orders.mjs';
const {defaults,documentBody}=createRequire(import.meta.url)('../js/vendor-orders.js');
const vendors=[{id:'a',name:'Supplier Alpha'},{id:'b',name:'Supplier Beta'}];
const catalog=[{id:'rice',name:'Rice',category:'Dry',unit:'kg',vendor:'Supplier Alpha'},{id:'oil',name:'Oil',category:'Dry',unit:'l',vendor:'Supplier Beta'}];
const indent={id:'indent',indentNumber:'REQ-1',outletId:'outlet',status:'Pending Approval',items:[{itemId:'rice',revisedQty:3,originalQty:4,comment:'Internal comment'},{itemId:'oil',revisedQty:2,originalQty:2}]};
const state=()=>({vendors,items:catalog,outlets:[{id:'outlet',name:'Sample Outlet'}],indents:[indent],requests:[{id:'r1',itemId:'rice',indentId:'indent',status:'Consolidated'},{id:'r2',itemId:'oil',indentId:'indent',status:'Consolidated'}],purchase_orders:[]});
const input=()=>({indentId:'indent',expectedDelivery:'2026-10-20',items:[{itemId:'rice',vendorId:'a',qty:3,notes:'Rice note'},{itemId:'oil',vendorId:'b',qty:2,notes:'Oil note'}]});
const actor={id:'admin',name:'Sample Admin',role:'admin'};

test('preferred vendors are preselected; zero lines are excluded and missing vendor requires a choice',()=>{
  const lines=defaults({...indent,items:[...indent.items,{itemId:'zero',revisedQty:0,originalQty:9}]},catalog,vendors);
  assert.deepEqual(lines.map(i=>i.vendorId),['a','b']);assert.equal(lines[0].qty,3);assert.equal(lines[0].notes,'');
  assert.equal(defaults(indent,[{...catalog[0],vendor:'Removed vendor'},catalog[1]],vendors)[0].vendorId,'');
});
test('grouping creates separate supplier orders without changing stock or catalog preferences',()=>{
  const s=state(),before=JSON.stringify(s);const changes=raiseVendorOrders(s,actor,input());
  const orders=changes.filter(c=>c.entity==='purchase_orders').map(c=>c.value);
  assert.equal(orders.length,2);assert.notEqual(orders[0].poNumber,orders[1].poNumber);
  assert.deepEqual(orders.map(p=>p.items.map(i=>i.itemId)),[['rice'],['oil']]);
  assert.deepEqual(changes.find(c=>c.key==='r1').value.purchaseOrderIds,[orders[0].id]);
  assert.equal(changes[0].value.status,'PO Raised (2 vendors)');assert.equal(changes[0].value.poNumber,undefined);
  assert.equal(JSON.stringify(s),before);
  const override=input();override.items[0].vendorId='b';
  assert.equal(raiseVendorOrders(s,actor,override).filter(c=>c.entity==='purchase_orders').length,1);
});
test('reject invalid vendor, duplicate or missing items, bad dates, quantities, completed and unauthorized requests',()=>{
  for(const edit of [i=>i.items[0].vendorId='missing',i=>i.items.push(i.items[0]),i=>i.items.pop(),i=>i.items[0].qty=0,i=>i.items[0].qty=NaN,i=>i.expectedDelivery='2026-02-30',i=>i.items[0].itemId='other']) {
    const i=input();edit(i);assert.throws(()=>raiseVendorOrders(state(),actor,i));
  }
  assert.throws(()=>raiseVendorOrders(state(),{...actor,role:'supervisor'},input()),e=>e.status===403);
  assert.throws(()=>raiseVendorOrders({...state(),purchase_orders:[{indentId:'indent'}]},actor,input()),e=>e.status===409);
  assert.throws(()=>raiseVendorOrders({...state(),indents:[{...indent,status:'Approved'}]},actor,input()),e=>e.status===409);
});
test('supplier document contains only that suppliers order and escapes markup',()=>{
  const orders=raiseVendorOrders(state(),actor,input()).filter(c=>c.entity==='purchase_orders').map(c=>c.value);
  const html=documentBody(orders[0]);
  assert.ok(html.includes('Supplier Alpha'));assert.ok(html.includes('Rice note'));
  for(const secret of ['Supplier Beta','Oil note','Internal comment',orders[1].poNumber,'REQ-1','Sample Admin'])assert.ok(!html.includes(secret),secret);
  assert.ok(documentBody({...orders[0],vendorName:'<script>alert(1)</script>'}).includes('&lt;script&gt;'));
});
