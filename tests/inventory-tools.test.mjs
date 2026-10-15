import { test } from 'node:test';
import assert from 'node:assert/strict';
await import('../js/inventory-tools.js');
const {day,timestamp,bounds,resolveOutlet,matchItems,report}=globalThis.InventoryTools;
test('IST calendar dates and report bounds do not depend on browser timezone',()=>{
    assert.equal(day('2026-10-14T18:29:59Z'),'2026-10-14');
    assert.equal(day('2026-10-14T18:30:00Z'),'2026-10-15');
    assert.deepEqual(bounds('2026-10-15','2026-10-15'),{start:Date.parse('2026-10-14T18:30:00Z'),end:Date.parse('2026-10-15T18:30:00Z')});
    assert.match(timestamp('2026-10-14T18:30:00Z'),/15 Oct 2026.*12:00.*am IST/);
    assert.throws(()=>bounds('2026-10-16','2026-10-15'));
});
test('cached outlets are validated against current assignments',()=>{
    assert.equal(resolveOutlet([{id:'brigade'}],'cafe'),'brigade');
    assert.equal(resolveOutlet([{id:'brigade'},{id:'cafe'}],'cafe'),'cafe');
    assert.equal(resolveOutlet([],'cafe'),'');
});
test('item search handles large lists, case and whitespace',()=>{
    const items=Array.from({length:10000},(_,id)=>({id,name:'Ingredient '+id}));
    assert.equal(matchItems(items,' INGREDIENT 9999 ')[0].id,9999);
    assert.equal(matchItems(items,'missing').length,0);
});
test('report reconstructs historical balances, cuisine usage and opening balances',()=>{
    const items=[{id:'rice',name:'Rice',active:false},{id:'empty',name:'Empty'},{id:'zero',name:'Zero'}];
    const entry=(delta,kind,created_at,cuisine='',item_id='rice')=>({outlet_id:'cafe',item_id,delta,kind,created_at,cuisine});
    const history=[entry(20,'opening','2026-10-13T12:00:00Z'),entry(10,'receipt','2026-10-14T18:30:00Z'),entry(-5,'distribute','2026-10-15T01:00:00Z','Indian'),entry(-2,'distribute','2026-10-15T02:00:00Z','Retired Cuisine'),entry(-1,'adjust','2026-10-15T03:00:00Z'),entry(3,'assign','2026-10-15T04:00:00Z'),entry(-4,'distribute','2026-10-15T18:30:00Z','Indian'),entry(2,'receipt','2026-10-15T02:00:00Z','','zero'),entry(-2,'distribute','2026-10-15T03:00:00Z','Indian','zero')];
    const balances=[{item_id:'rice',outlet_id:'cafe',quantity:21},{item_id:'zero',outlet_id:'cafe',quantity:0}];
    const result=report(items,balances,history,'cafe','2026-10-15','2026-10-15');
    assert.deepEqual(result.cuisines,['Indian','Retired Cuisine']);
    const rice=result.rows.find(r=>r.item.id==='rice');
    assert.equal(rice.opening,20);assert.equal(rice.received,13);assert.equal(rice.adjustments,-1);assert.equal(rice.remaining,25);assert.deepEqual(rice.usage,{Indian:5,'Retired Cuisine':2});
    assert.ok(result.rows.some(r=>r.item.id==='zero'));assert.ok(!result.rows.some(r=>r.item.id==='empty'));
    assert.equal(report(items,balances,history,'other','2026-10-15','2026-10-15').rows.length,0);
});

test('cuisine edits recompute totals while preserving original requests and zero revisions',()=>{
    const entry={chefRequests:[{cuisine:'Indian',qty:6},{cuisine:'Indian',qty:4},{cuisine:'Chinese',qty:3}],revisedQty:13};
    InventoryTools.reviseCuisine(entry,'Indian',5);
    assert.deepEqual(entry.chefRequests.map(r=>r.revisedQty),[3,2,undefined]);
    assert.equal(entry.revisedQty,8);
    InventoryTools.reviseCuisine(entry,'Chinese',0);assert.equal(entry.revisedQty,5);
    InventoryTools.reviseCuisine(entry,'Indian',0);assert.equal(entry.revisedQty,0);
    InventoryTools.reviseCuisine(entry,'Indian',2);assert.equal(entry.revisedQty,2);
    assert.deepEqual(entry.chefRequests.map(r=>r.qty),[6,4,3]);
    assert.throws(()=>InventoryTools.reviseCuisine(entry,'Indian',-1));
});
