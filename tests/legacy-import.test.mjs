import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,validateLegacyCSV,encodeCSV,importHeaders,maxImportRows} from '../shared/legacy-import.mjs';
const actor={role:'purchaser',assignedLocations:['a']};
const state={outlets:[{id:'a',name:'Kitchen A'},{id:'b',name:'Kitchen B'}],items:[{id:'rice',name:'Rice, fine',category:'Grocery',unit:'kg'},{id:'oil',name:'Oil',category:'Grocery',unit:'l'}],operationRecords:[{kind:'category',name:'Grocery'},{kind:'unit',name:'kg'},{kind:'unit',name:'l'}],outletStock:[{item_id:'rice',outlet_id:'a',quantity:2}],legacyStock:[]};
const sheet=rows=>encodeCSV([importHeaders,...rows]);

test('Excel CSV handles BOM, CRLF, quoted commas/newlines and escaped quotes',()=>{
    assert.deepEqual(parseCSV('\uFEFFA,B\r\n"a,b","line1\nline2"\r\n"a""b",last\r\n').rows,[{row:1,cells:['A','B']},{row:2,cells:['a,b','line1\nline2']},{row:3,cells:['a"b','last']}]);
    const result=validateLegacyCSV(sheet([['Kitchen A','Rice, fine','grocery','KG','3.5','12.50']]),state,actor);
    assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].resultingQuantity,5.5);assert.equal(result.rows[0].unitCostMinor,1250);
});
test('semicolon CSV and optional omitted unit-price column work',()=>{
    const result=validateLegacyCSV('Outlet;Item;Category;Unit;Quantity\r\nKitchen A;Oil;Grocery;l;3',state,actor);
    assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].unitCostMinor,null);
});
test('collects all row errors including allowed-list mismatches and access scope',()=>{
    const result=validateLegacyCSV(sheet([
        ['Kitchen B','Rice, fine','Typo','bags','-1','1.001'],
        ['Kitchen A','Missing item','Grocery','kg','abc',''],
        ['Kitchen A','Oil','Grocery','kg','2','0'],
    ]),state,actor);
    for(const column of ['Outlet','Category','Unit','Quantity','Unit price'])assert.ok(result.errors.some(e=>e.row===2 && e.column===column),column);
    assert.ok(result.errors.some(e=>e.row===3 && e.column==='Item'));
    assert.ok(result.errors.some(e=>e.row===3 && e.column==='Quantity'));
    assert.ok(result.errors.some(e=>e.row===4 && e.column==='Unit' && e.message.includes('match')));
});
test('duplicate rows identify both Excel rows; blank rows preserve row numbers',()=>{
    const result=validateLegacyCSV(sheet([['Kitchen A','Oil','Grocery','l','1',''],['','','','','',''],['Kitchen A','Oil','Grocery','l','2','']]),state,actor);
    assert.deepEqual(result.errors.filter(e=>e.column==='Duplicate').map(e=>e.row),[2,4]);
});
test('bad headers, malformed quoting, inactive items, reconciliation and limits are reported',()=>{
    assert.ok(validateLegacyCSV('Item,Item\nOil,Oil',state,actor).errors.some(e=>e.row===1 && e.message.includes('more than once')));
    assert.ok(parseCSV('A,B\n"unclosed,cell').errors.some(e=>e.row===2));
    const one=sheet([['Kitchen A','Rice, fine','Grocery','kg','1','']]);
    assert.ok(validateLegacyCSV(one,{...state,items:state.items.map(i=>({...i,active:false}))},actor).errors.some(e=>e.message.includes('inactive')));
    assert.ok(validateLegacyCSV(one,{...state,legacyStock:[{item_id:'rice',issue:'Unverified'}]},actor).errors.some(e=>e.message.includes('reconciliation')));
    assert.ok(validateLegacyCSV(sheet(Array.from({length:maxImportRows+1},()=>['Kitchen A','Oil','Grocery','l','1',''])),state,actor).errors.some(e=>e.row===1 && e.message.includes('Maximum')));
    assert.ok(validateLegacyCSV('a'.repeat(100001),state,actor).errors.some(e=>e.column==='File'));
});
test('rejects formulas, bad encoding and unsafe totals; downloads neutralize formula cells',()=>{
    assert.ok(validateLegacyCSV(sheet([['Kitchen A','Oil','Grocery','l','=1+2','']]),state,actor).errors.some(e=>e.column==='Quantity'));
    assert.ok(validateLegacyCSV(sheet([['Kitchen A','Oil','Grocery','l','1000000000','1000000000']]),state,actor).errors.some(e=>e.column==='Unit price'));
    assert.ok(validateLegacyCSV('O\0u\0t\0l\0e\0t\0',state,actor).errors.some(e=>e.message.includes('encoding')));
    assert.ok(encodeCSV([['=SUM(A1:A2)','+cmd','@data']]).includes("'=SUM"));
});
