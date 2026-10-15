import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
await import('../js/inventory-tools.js');
function setup(user, outlets) {
    const cache=new Map();
    const context={window:{},currentUser:user,currentStoreView:'',outletsData:outlets,InventoryTools:globalThis.InventoryTools,document:{},localStorage:{getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value)}};
    runInNewContext(readFileSync('js/inventory-ui.js','utf8'),context);
    return {context,selection:context.window.OutletSelection,cache};
}
test('single-outlet supervisor gets a fixed field with an allowed submitted value',()=>{
    const {selection}=setup({id:'sup',role:'supervisor',assignedLocations:['brigade']},[{id:'cafe',name:'Cafe'},{id:'brigade',name:'Brigade'}]);
    const markup=selection.markup();
    assert.match(markup,/type="hidden" name="outletId" value="brigade"/);
    assert.doesNotMatch(markup,/<select|Cafe/);
    assert.equal(selection.choose('cafe'),'brigade');
});
test('outlet cache is isolated by user and checked after assignments change',()=>{
    const {context,selection,cache}=setup({id:'admin',role:'admin',assignedLocations:['all']},[{id:'cafe',name:'Cafe'},{id:'brigade',name:'Brigade'}]);
    selection.restore();selection.choose('brigade');assert.equal(cache.get('nchef_outlet_admin'),'brigade');
    context.currentUser={id:'sup',role:'supervisor',assignedLocations:['cafe']};
    assert.equal(selection.restore(),'cafe');
    context.currentUser={id:'admin',role:'admin',assignedLocations:['all']};assert.equal(selection.restore(),'brigade');
    context.outletsData=[{id:'cafe',name:'Cafe'}];assert.equal(selection.restore(),'cafe');
});
test('supervisor cannot open admin-only overview through a saved route',()=>{
    const calls=[];
    const context={window:{switchToView:view=>calls.push(view)},InventoryTools:globalThis.InventoryTools,document:{addEventListener(){}},currentUser:{role:'supervisor'}};
    runInNewContext(readFileSync('js/stock-actions.js','utf8'),context);
    assert.equal(context.window.showInventoryView('inventory:overview'),true);
    assert.deepEqual(calls,['viewMasterOrders']);
});
