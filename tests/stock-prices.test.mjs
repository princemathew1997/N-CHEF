import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setAvailableStockPrice,stockPriceEditingEnabled} from '../worker/stock-prices.mjs';

const admin={id:'admin',name:'Admin',role:'admin'};
const purchaser={id:'purchaser',name:'Purchaser',role:'purchaser',assignedLocations:['brigade']};
const state=()=>({items:[{id:'rice',name:'Rice',unit:'kg',active:false}],outlets:[{id:'brigade'},{id:'cafe'}],outletStock:[{item_id:'rice',outlet_id:'brigade',quantity:2.5,unit_cost_minor:null},{item_id:'rice',outlet_id:'cafe',quantity:0,unit_cost_minor:100}],legacyStock:[]});
const input={itemId:'rice',outletId:'brigade',unitPrice:12.5,reason:'Verified current stock price',expectedQuantity:2.5,expectedUnitCostMinor:null};

test('available stock can be priced regardless of its origin or inactive catalog status',()=>{
 const original=state();
 for(const actor of [admin,purchaser]){
  const result=setAvailableStockPrice(original,actor,input);
  assert.equal(result.outletStock[0].quantity,2.5);assert.equal(result.outletStock[0].unit_cost_minor,1250);
  assert.equal(result.stockPriceUpdates[0].stockValueMinor,3125);
  assert.equal(result.stockPriceUpdates[0].previousUnitCostMinor,null);
  assert.equal(result.movements[0].delta,0);assert.equal(result.movements[0].total_cost_minor,0);assert.equal(result.movements[0].kind,'price');
 }
 assert.equal(original.outletStock[0].unit_cost_minor,null);
});

test('current stock price edits enforce roles, outlets, availability and stale snapshots',()=>{
 for(const role of ['cuisine_head','executive_chef'])assert.throws(()=>setAvailableStockPrice(state(),{...purchaser,role},input),e=>e.status===403);
 assert.throws(()=>setAvailableStockPrice(state(),purchaser,{...input,outletId:'cafe'}),e=>e.status===403);
 assert.throws(()=>setAvailableStockPrice(state(),admin,{...input,outletId:'cafe',expectedQuantity:0,expectedUnitCostMinor:100}),/available stock/);
 assert.throws(()=>setAvailableStockPrice(state(),admin,{...input,outletId:'missing'}),e=>e.status===403);
 assert.throws(()=>setAvailableStockPrice(state(),admin,{...input,itemId:'missing'}),e=>e.status===404);
 for(const changed of [{expectedQuantity:3},{expectedUnitCostMinor:0}])assert.throws(()=>setAvailableStockPrice(state(),admin,{...input,...changed}),e=>e.status===409);
});

test('stock prices require a reason and finite two-decimal amounts with supported totals',()=>{
 for(const unitPrice of [-1,Infinity,NaN,1.001,'12.5',null])assert.throws(()=>setAvailableStockPrice(state(),admin,{...input,unitPrice}));
 assert.throws(()=>setAvailableStockPrice(state(),admin,{...input,reason:''}),/reason/);
 assert.equal(setAvailableStockPrice(state(),admin,{...input,unitPrice:0}).stockPriceUpdates[0].stockValueMinor,0);
 const large=state();large.outletStock[0].quantity=1e9;
 assert.throws(()=>setAvailableStockPrice(large,admin,{...input,expectedQuantity:1e9,unitPrice:1e9}),/supported range/);
});

test('temporary stock-price utility can be switched off without changing saved data',()=>{
 assert.equal(stockPriceEditingEnabled({}),true);
 assert.equal(stockPriceEditingEnabled({NCHEF_STOCK_PRICE_EDITING:'enabled'}),true);
 assert.equal(stockPriceEditingEnabled({NCHEF_STOCK_PRICE_EDITING:'disabled'}),false);
});
