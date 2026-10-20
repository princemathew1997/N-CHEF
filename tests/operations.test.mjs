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

test('user directory follows role hierarchy and hides unrelated outlets',()=>{
    const users=[['admin','admin',['all']],['p','purchaser',['a']],['exec','executive_chef',['a']],['head','cuisine_head',['a','b']],['outside','cuisine_head',['b']],['peer','purchaser',['a']]].map(([id,role,assignedLocations])=>({id,role,assignedLocations}));
    const state={outlets:[{id:'a'},{id:'b'}],items:[],requests:[],indents:[],purchase_orders:[],users,vendors:[]};
    const directory=id=>project(state,users.find(u=>u.id===id)).users;
    assert.equal(directory('admin').length,6);
    assert.deepEqual(directory('p').map(u=>u.id),['p','exec','head']);
    assert.deepEqual(directory('exec').map(u=>u.id),['exec','head']);
    assert.deepEqual(directory('head').map(u=>u.id),['head']);
    assert.deepEqual(directory('p').find(u=>u.id==='head').assignedLocations,['a']);
});

test('legacy opening stock joins the normal outlet balance and is consumed normally',()=>{
 const actor={id:'p',name:'Purchaser',role:'purchaser',assignedLocations:['a']};
 const state={outlets:[{id:'a'}],items:[{id:'rice',name:'Rice',unit:'kg'}],vendors:[],cuisines:[{name:'Indian'}],outletStock:[{item_id:'rice',outlet_id:'a',quantity:2}],legacyStock:[],requests:[],operationRecords:[]};
 const opened=stockCommand(state,actor,{outletId:'a',itemId:'rice',quantity:5,unitPrice:4},'opening');
 assert.equal(opened.outletStock[0].quantity,7);assert.equal(opened.legacyStock.length,0);assert.equal(opened.movements[0].vendor,'Legacy Stock');assert.equal(opened.outletStock[0].unit_cost_minor,400);
 const issued=stockCommand({...state,...opened},actor,{outletId:'a',itemId:'rice',quantity:3,cuisine:'Indian'},'distribute');assert.equal(issued.outletStock[0].quantity,4);
 assert.throws(()=>stockCommand(state,{...actor,assignedLocations:['b']},{outletId:'a',itemId:'rice',quantity:1},'opening'));
});
