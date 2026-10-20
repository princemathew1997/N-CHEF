import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stockCommand} from '../worker/stock.mjs';
import {project} from '../worker/model.mjs';

test('historical approvals cannot be issued again after role migration',()=>{
    const actor={id:'p',role:'purchaser',assignedLocations:['outlet']};
    const state={outlets:[{id:'outlet'}],items:[{id:'item',name:'Rice',unit:'kg'}],cuisines:[{name:'Indian'}],legacyStock:[],outletStock:[{item_id:'item',outlet_id:'outlet',quantity:10}],operationRecords:[],requests:[{id:'old',itemId:'item',outletId:'outlet',cuisine:'Indian',status:'Approved',qty:5,legacyIssuedQuantity:5}]};
    assert.throws(()=>stockCommand(state,actor,{itemId:'item',outletId:'outlet',cuisine:'Indian',quantity:1,requestId:'old'},'distribute'),e=>e.status===409);
    assert.equal(state.outletStock[0].quantity,10);
});

test('purchaser projection hides other outlets while retaining unassigned central stock',()=>{
    const actor={id:'p',role:'purchaser',assignedLocations:['a']};
    const state={outlets:[{id:'a'},{id:'b'}],items:[{id:'rice',bought:20,allocations:{a:5,b:7},consumed:{a:1,b:2}}],requests:[],indents:[],purchase_orders:[],users:[actor],vendors:[{id:'v',name:'Vendor',gstin:'private'}],outletStock:[{outlet_id:'a',quantity:4},{outlet_id:'b',quantity:5}],stockHistory:[],legacyStock:[{item_id:'rice',quantity:8}],operationRecords:[]};
    const result=project(state,actor);
    assert.deepEqual(result.items[0].allocations,{a:5});
    assert.deepEqual(result.items[0].consumed,{a:1});
    assert.equal(result.items[0].bought,13);
    assert.equal(result.legacyStock[0].quantity,8);
    assert.equal(result.outletStock.length,1);
    assert.deepEqual(result.vendors,[{id:'v',name:'Vendor'}]);
});
