import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';

let mf, db;
const origin = 'http://localhost';
const adminPassword = 'test-admin-password-2026';
const userPassword = 'test-outlet-password-2026';
const testReleaseCommit = 'a'.repeat(40);
let adminCookie, adminId, chefCookie, supervisorCookie, chefId, supervisorId;
async function request(path, method = 'GET', input, cookie = adminCookie, clientRelease = testReleaseCommit) {
    const res = await mf.dispatchFetch(origin + '/api/' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(clientRelease ? {'X-NCHEF-Client-Release':clientRelease} : {}) }, body: input ? JSON.stringify(input) : undefined });
    return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
async function save(changes, cookie = adminCookie, revision) {
    if (revision === undefined) revision = (await request('state', 'GET', undefined, cookie)).data.revision;
    return request('changes', 'POST', { revision, operationId: crypto.randomUUID(), changes }, cookie);
}
before(async () => {
    const bundle = await build({ entryPoints: ['worker/index.mjs'], bundle: true, format: 'esm', platform: 'browser', write: false });
    mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-14', d1Databases: ['DB'], bindings: { SETUP_TOKEN: 'test-setup-token', NCHEF_RELEASE_COMMIT:testReleaseCommit, NCHEF_RELEASE_VERSION:'1.0.0' } }));
    db = await mf.getD1Database('DB');
    for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) {
        const sql = readFileSync('migrations/' + file, 'utf8');
        // SQLite's parser handles complete scripts; D1 exec expects statements on one line.
        await db.exec(sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim());
    }
});
after(async () => { await mf?.dispose(); });

test('secure setup, login, permissions, atomic approval and conflicts', async () => {
    assert.equal((await request('state', 'GET', undefined, '')).status, 401);
    assert.equal((await request('setup', 'POST', { setupToken: 'wrong', username: 'admin', name: 'Admin', password: adminPassword }, '')).status, 403);
    assert.equal((await request('setup', 'POST', { setupToken: 'test-setup-token', username: 'admin', name: 'Admin', password: adminPassword }, '')).status, 201);
    assert.equal((await request('setup', 'POST', { setupToken: 'test-setup-token', username: 'other', name: 'Other', password: adminPassword }, '')).status, 409);
    const login = await request('login', 'POST', { username: 'ADMIN', password: adminPassword }, '');
    assert.equal(login.status, 200);
    adminCookie = login.cookie; adminId = login.data.user.id;
    assert.ok(adminCookie); assert.ok(!JSON.stringify(login.data).includes('password'));
    assert.ok((await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(adminId).first()).password_hash.startsWith('pbkdf2-sha256:'));
    const chef = { id: crypto.randomUUID(), username: 'chef_test', name: 'Chef Test', role: 'chef', assignedLocations: ['brigade'], assignedSections: ['Indian'], password: userPassword };
    const sup = { id: crypto.randomUUID(), username: 'supervisor_test', name: 'Supervisor Test', role: 'supervisor', assignedLocations: ['brigade'], password: userPassword };
    chefId = chef.id; supervisorId = sup.id;
    assert.equal((await save([{ entity: 'users', key: chef.id, value: chef }, { entity: 'users', key: sup.id, value: sup }])).status, 200);
    chefCookie = (await request('login', 'POST', { username: chef.username, password: userPassword }, '')).cookie;
    supervisorCookie = (await request('login', 'POST', { username: sup.username, password: userPassword }, '')).cookie;
    const chefState = (await request('state', 'GET', undefined, chefCookie)).data;
    assert.equal(chefState.outlets.length, 1);
    assert.deepEqual(chefState.users.map(u => u.id), [chef.id]);
    assert.equal((await save([{ entity: 'users', key: adminId, value: { ...login.data.user, name: 'Hacked' } }], chefCookie)).status, 403);
    const requestId = crypto.randomUUID();
    const req = { id: requestId, itemId: 'item_01', itemName: 'Tuna', unit: 'pcs', outletId: 'brigade', outletName: 'BRIGADE', qty: 5, cuisine: 'Indian', status: 'Pending', requestedBy: 'Forged Admin' };
    assert.equal((await save([{ entity: 'requests', key: requestId, value: { ...req, outletId: 'cafe' } }], chefCookie)).status, 403);
    assert.equal((await save([{ entity: 'requests', key: requestId, value: { ...req, cuisine: 'Chinese' } }], chefCookie)).status, 403);
    const created = await save([{ entity: 'requests', key: requestId, value: req }], chefCookie);
    assert.equal(created.status, 200);
    assert.equal(created.data.requests[0].ownerId, chefId);
    assert.equal(created.data.requests[0].requestedBy, 'Chef Test');
    const unauthorized = await save([{ entity: 'requests', key: requestId, value: { ...created.data.requests[0], status: 'Approved' } }], supervisorCookie);
    assert.equal(unauthorized.status, 400);
    const indentId = crypto.randomUUID();
    const indent = { id: indentId, indentNumber: 'REQ-TEST-1', outletId: 'brigade', outletName: 'BRIGADE', status: 'Pending Approval', items: [{ itemId: 'item_01', originalQty: 5, revisedQty: 5, comment: '' }] };
    const consolidated = await save([{ entity: 'indents', key: indentId, value: indent }, { entity: 'requests', key: requestId, value: { ...created.data.requests[0], status: 'Consolidated', indentId } }], supervisorCookie);
    assert.equal(consolidated.status, 200, JSON.stringify(consolidated.data));
    const state = (await request('state')).data;
    const item = state.items.find(i => i.id === 'item_01');
    const approved = state.indents.find(i => i.id === indentId);
    const linked = state.requests.find(r => r.id === requestId);
    const changes = [{ entity: 'items', key: item.id, value: { ...item, allocations: { brigade: 5 } } }, { entity: 'indents', key: indentId, value: { ...approved, status: 'Approved' } }, { entity: 'requests', key: requestId, value: { ...linked, status: 'Approved' } }];
    assert.equal((await save(changes)).status, 400); // stock cannot be edited through catalog
    assert.equal((await request('state')).data.indents[0].status, 'Pending Approval');
    const stockAction = async (path, input, cookie = adminCookie) => request(path, 'POST', { ...input, operationId: crypto.randomUUID(), revision: (await request('state', 'GET', undefined, cookie)).data.revision }, cookie);
    assert.equal((await stockAction('indents/approve',{indentId})).status,409);
    assert.equal((await request('state')).data.indents.find(i=>i.id===indentId).status,'Pending Approval');
    const receiptInput = { itemId:'item_01',outletId:'brigade',vendor:item.vendor,quantity:10 };
    assert.equal((await stockAction('stock/receipt',receiptInput,chefCookie)).status,403);
    assert.equal((await stockAction('stock/receipt',{...receiptInput,outletId:'cafe'},supervisorCookie)).status,403);
    assert.equal((await stockAction('stock/receipt',receiptInput,supervisorCookie)).status,200);
    const before = (await request('state')).data;
    assert.equal((await stockAction('indents/approve',{indentId},supervisorCookie)).status,403);
    const approval = {indentId,operationId:crypto.randomUUID(),revision:before.revision};
    const result=await request('indents/approve','POST',approval);
    assert.equal(result.status,200,JSON.stringify(result.data));
    assert.equal((await request('indents/approve','POST',approval)).status,200);
    const balance=async()=> (await db.prepare("SELECT quantity FROM outlet_stock WHERE item_id='item_01' AND outlet_id='brigade'").first()).quantity;
    assert.equal(await balance(),5);
    assert.equal((await stockAction('stock/distribute',{itemId:item.id,outletId:'brigade',cuisine:'Indian',quantity:6},supervisorCookie)).status,409);
    assert.equal((await stockAction('stock/distribute',{itemId:item.id,outletId:'brigade',cuisine:'Indian',quantity:2.5},supervisorCookie)).status,200);
    assert.equal(await balance(),2.5);
    assert.equal((await stockAction('stock/adjust',{itemId:item.id,outletId:'brigade',quantity:3},supervisorCookie)).status,400);
    assert.equal((await stockAction('stock/adjust',{itemId:item.id,outletId:'brigade',quantity:3,reason:'Physical count'},supervisorCookie)).status,200);
    assert.equal(await balance(),3);
    const sameStockRevision=(await request('state')).data.revision;
    const race=await Promise.all([1,2].map(()=>request('stock/distribute','POST',{itemId:item.id,outletId:'brigade',cuisine:'Indian',quantity:2,revision:sameStockRevision,operationId:crypto.randomUUID()},supervisorCookie)));
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(await balance(),1);
    const poId = crypto.randomUUID();
    const po = { id: poId, poNumber: 'PO-TEST-1', vendorId: 'v_01', outletId: 'brigade', items: [{ itemId: 'item_01', qty: 4 }], status: 'PO Raised' };
    assert.equal((await save([{ entity: 'purchase_orders', key: poId, value: po }])).status, 200);
    const poRevision = (await request('state', 'GET', undefined, supervisorCookie)).data.revision;
    const receipt = { poId, operationId: crypto.randomUUID(), revision: poRevision };
    assert.equal((await request('purchase-orders/receive', 'POST', receipt, supervisorCookie)).status, 200);
    assert.equal((await request('purchase-orders/receive', 'POST', receipt, supervisorCookie)).status, 200);
    assert.equal((await stockAction('purchase-orders/receive', { poId }, supervisorCookie)).status, 409);
    assert.equal(await balance(),5);
    const catalog={...item,id:'new_catalog',name:'New ingredient',active:true};
    assert.equal((await save([{entity:'items',key:catalog.id,value:catalog}],supervisorCookie)).status,403);
    assert.equal((await save([{entity:'items',key:catalog.id,value:catalog}])).status,200);
    assert.equal((await save([{entity:'items',key:'duplicate',value:{...catalog,id:'duplicate',name:' NEW INGREDIENT '}}])).status,409);
    assert.equal((await save([{entity:'items',key:item.id,value:{...item,unit:'litres'}}])).status,400);
    const deactivate={...catalog,active:false};
    assert.equal((await save([{entity:'items',key:catalog.id,value:deactivate}])).status,200);
    assert.equal((await stockAction('stock/receipt',{...receiptInput,itemId:catalog.id})).status,400);
    assert.equal((await save([{entity:'items',key:catalog.id,value:null}])).status,400);
    assert.equal((await request('stock/consume','POST',{itemId:item.id,outletId:'brigade',quantity:1})).status,404);
    await db.prepare("UPDATE legacy_stock SET quantity=8 WHERE item_id='item_01'").run();
    assert.equal((await stockAction('stock/assign',{itemId:item.id,outletId:'brigade',quantity:3},supervisorCookie)).status,403);
    assert.equal((await stockAction('stock/assign',{itemId:item.id,outletId:'brigade',quantity:3})).status,200);
    assert.equal((await stockAction('stock/assign',{itemId:item.id,outletId:'cafe',quantity:2})).status,200);
    assert.equal((await db.prepare("SELECT quantity FROM legacy_stock WHERE item_id='item_01'").first()).quantity,3);
    assert.equal((await stockAction('stock/assign',{itemId:item.id,outletId:'brigade',quantity:4})).status,409);
    await db.prepare("UPDATE legacy_stock SET issue='Needs verification' WHERE item_id='item_01'").run();
    assert.equal((await stockAction('stock/assign',{itemId:item.id,outletId:'brigade',quantity:1})).status,409);
    assert.equal((await stockAction('stock/reconcile',{itemId:item.id,quantity:2,reason:'Verified physical count'})).status,200);
    assert.equal((await db.prepare("SELECT issue FROM legacy_stock WHERE item_id='item_01'").first()).issue,'');
    assert.equal((await save([{entity:'items',key:item.id,value:{...item,name:'Tuna revised'}}])).status,200);
    assert.ok((await request('state')).data.stockHistory.some(m=>m.item_name===item.name));
    assert.equal((await stockAction('cuisines/add',{name:'Test Cuisine'})).status,200);
    assert.equal((await stockAction('cuisines/add',{name:'Test Cuisine'})).status,409);
    assert.equal((await stockAction('cuisines/add',{name:'Other Cuisine'},supervisorCookie)).status,403);
    const standalone={id:crypto.randomUUID(),itemId:item.id,outletId:'cafe',cuisine:'Indian',qty:1,status:'Pending'};
    assert.equal((await save([{entity:'requests',key:standalone.id,value:standalone}])).status,200);
    assert.equal((await stockAction('requests/approve',{requestId:standalone.id,quantity:1},supervisorCookie)).status,403);
    const standaloneApproval={requestId:standalone.id,quantity:1,operationId:crypto.randomUUID(),revision:(await request('state')).data.revision};
    assert.equal((await request('requests/approve','POST',standaloneApproval)).status,200);
    assert.equal((await request('requests/approve','POST',standaloneApproval)).status,200);
    assert.equal((await stockAction('requests/approve',{requestId:standalone.id,quantity:1})).status,409);
    assert.equal((await db.prepare("SELECT quantity FROM outlet_stock WHERE item_id='item_01' AND outlet_id='cafe'").first()).quantity,1);
    const scoped=(await request('state','GET',undefined,supervisorCookie)).data;
    assert.ok(scoped.outletStock.every(s=>s.outlet_id==='brigade'));
    assert.ok(scoped.stockHistory.every(s=>s.outlet_id==='brigade'));
    assert.deepEqual(scoped.legacyStock,[]);
    assert.ok(scoped.stockHistory.some(m=>m.item_name===item.name && m.unit===item.unit && m.actor_name==='Supervisor Test'));
    await assert.rejects(db.prepare("DELETE FROM outlet_stock_history").run(),/append only/);
    assert.equal((await save(changes, adminCookie, before.revision)).status, 409);
    // Chef and supervisor requirements consolidate together; edited cuisine quantities drive approval.
    const catalogState=(await request('state')).data;
    const second=catalogState.items.find(i=>i.id==='item_02');
    assert.equal((await stockAction('stock/receipt',{itemId:second.id,outletId:'brigade',vendor:second.vendor,quantity:20},supervisorCookie)).status,200);
    const chefRequirement={id:crypto.randomUUID(),itemId:second.id,outletId:'brigade',cuisine:'Indian',qty:6,status:'Pending'};
    const ownRequirement={id:crypto.randomUUID(),itemId:second.id,outletId:'brigade',cuisine:'Chinese',qty:4,status:'Pending'};
    const chefSaved=await save([{entity:'requests',key:chefRequirement.id,value:chefRequirement}],chefCookie);
    assert.equal(chefSaved.status,200);
    const ownSaved=await save([{entity:'requests',key:ownRequirement.id,value:ownRequirement}],supervisorCookie);
    assert.equal(ownSaved.status,200);
    const source=(await request('state')).data;
    assert.equal((await save([{entity:'purchase_orders',key:'bad_po',value:{...po,id:'bad_po',status:'PO Raised',items:[{itemId:item.id,qty:4,receivedQty:3}]}}])).status,400);
    const combinedId=crypto.randomUUID();
    const combined={id:combinedId,indentNumber:'REQ-CUISINE-TEST',outletId:'brigade',status:'Pending Approval',items:[{itemId:second.id,originalQty:10,revisedQty:7.5,cuisineBreakdown:[{cuisine:'Indian',qty:2.5},{cuisine:'Chinese',qty:5}]}]};
    const combine=[{entity:'indents',key:combinedId,value:combined},...[[chefRequirement.id,2.5],[ownRequirement.id,5]].map(([key,revisedQty])=>({entity:'requests',key,value:{...source.requests.find(r=>r.id===key),revisedQty,status:'Consolidated',indentId:combinedId}}))];
    assert.equal((await save([{...combine[0],value:{...combined,items:[{...combined.items[0],revisedQty:8}]}},...combine.slice(1)],supervisorCookie)).status,400);
    assert.equal((await save(combine,supervisorCookie)).status,200);
    const linkedState=(await request('state')).data;
    assert.equal((await save([{entity:'requests',key:chefRequirement.id,value:{...linkedState.requests.find(r=>r.id===chefRequirement.id),revisedQty:99}}],supervisorCookie)).status,409);
    assert.equal((await stockAction('indents/approve',{indentId:combinedId})).status,200);
    const cuisineState=(await request('state')).data;
    const moves=cuisineState.stockHistory.filter(m=>m.item_id===second.id && m.kind==='distribute');
    assert.equal(moves.filter(m=>m.cuisine==='Indian').reduce((sum,m)=>sum-m.delta,0),2.5);
    assert.equal(moves.filter(m=>m.cuisine==='Chinese').reduce((sum,m)=>sum-m.delta,0),5);
    assert.equal(cuisineState.outletStock.find(b=>b.item_id===second.id && b.outlet_id==='brigade').quantity,12.5);
    const latest = (await request('state')).data;
    const op = crypto.randomUUID();
    const vendorChange = { revision: latest.revision, operationId: op, changes: [{ entity: 'vendors', key: 'vendor_new', value: { id: 'vendor_new', name: 'New Vendor' } }] };
    assert.equal((await request('changes', 'POST', vendorChange)).status, 200);
    assert.equal((await request('changes', 'POST', vendorChange)).status, 200); // same command is idempotent
    const sameRevision = (await request('state')).data.revision;
    const simultaneous = await Promise.all([
        save([{ entity: 'vendors', key: 'vendor_a', value: { id: 'vendor_a', name: 'Vendor A' } }], adminCookie, sameRevision),
        save([{ entity: 'vendors', key: 'vendor_b', value: { id: 'vendor_b', name: 'Vendor B' } }], adminCookie, sameRevision),
    ]);
    assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 409]);
    const wrongOrigin = await mf.dispatchFetch(origin + '/api/logout', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json', Cookie: adminCookie }, body: '{}' });
    assert.equal(wrongOrigin.status, 403);
    assert.equal((await request('logout', 'POST', {}, chefCookie)).status, 200);
    assert.equal((await request('state', 'GET', undefined, chefCookie)).status, 401);
    await db.prepare('UPDATE sessions SET expires_at = 0 WHERE user_id = ?').bind(supervisorId).run();
    assert.equal((await request('state', 'GET', undefined, supervisorCookie)).status, 401);
    const secureLogin = await mf.dispatchFetch('https://nchef.example/api/login', { method: 'POST', headers: { Origin: 'https://nchef.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: adminPassword }) });
    assert.equal(secureLogin.status, 200);
    assert.match(secureLogin.headers.get('set-cookie'), /^__Host-nchef_session=/);
    assert.match(secureLogin.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
    for (let i = 0; i < 15; i++) assert.equal((await request('login', 'POST', { username: 'nonexistent', password: 'invalid-password-2026' }, '')).status, 401);
    assert.equal((await request('login', 'POST', { username: 'nonexistent', password: 'invalid-password-2026' }, '')).status, 429);
});

test('vendor orders save atomically, retry safely and receive per supplier', async () => {
    chefCookie=(await request('login','POST',{username:'chef_test',password:userPassword},'')).cookie;
    const vendorA={id:crypto.randomUUID(),name:'Order Supplier A'},vendorB={id:crypto.randomUUID(),name:'Order Supplier B'};
    const rows=[vendorA,vendorB].map((vendor,index)=>({id:crypto.randomUUID(),name:'Supplier item '+index,category:'Order test',unit:'kg',vendor:vendor.name,bought:0,allocations:{},consumed:{}}));
    assert.equal((await save([...([vendorA,vendorB].map(value=>({entity:'vendors',key:value.id,value}))),...rows.map(value=>({entity:'items',key:value.id,value}))])).status,200);
    const indent={id:crypto.randomUUID(),indentNumber:'REQ-VENDOR-TEST',outletId:'brigade',status:'Pending Approval',items:rows.map(row=>({itemId:row.id,originalQty:4,revisedQty:3}))};
    const sourceRequests=rows.map(row=>({id:crypto.randomUUID(),itemId:row.id,outletId:'brigade',cuisine:'Indian',qty:4,revisedQty:3,status:'Consolidated',indentId:indent.id}));
    assert.equal((await save([{entity:'indents',key:indent.id,value:indent},...sourceRequests.map(value=>({entity:'requests',key:value.id,value}))])).status,200);
    const state=(await request('state')).data;
    const input={indentId:indent.id,expectedDelivery:'2026-10-20',items:rows.map((row,index)=>({itemId:row.id,qty:3,vendorId:[vendorA,vendorB][index].id,notes:'For supplier '+index})),operationId:crypto.randomUUID(),revision:state.revision};
    assert.equal((await request('purchase-orders/raise','POST',input,chefCookie)).status,403);
    assert.equal((await request('purchase-orders/raise','POST',{...input,operationId:crypto.randomUUID(),items:[input.items[0],{...input.items[1],vendorId:'missing'}]})).status,400);
    assert.equal((await request('state')).data.purchase_orders.filter(p=>p.indentId===indent.id).length,0);
    const result=await request('purchase-orders/raise','POST',input);
    assert.equal(result.status,200,JSON.stringify(result.data));
    const orders=result.data.purchase_orders.filter(p=>p.indentId===indent.id);
    assert.equal(orders.length,2);assert.deepEqual(orders.map(p=>p.items.length),[1,1]);
    assert.equal(result.data.stockHistory.length,state.stockHistory.length);
    assert.deepEqual(result.data.outletStock,state.outletStock);
    assert.equal(result.data.indents.find(i=>i.id===indent.id).status,'PO Raised (2 vendors)');
    for(const source of sourceRequests){const linked=result.data.requests.find(r=>r.id===source.id);assert.equal(linked.status,'PO Raised');assert.deepEqual(linked.purchaseOrderIds,orders.filter(p=>p.items.some(i=>i.itemId===source.itemId)).map(p=>p.id));}
    assert.equal((await request('purchase-orders/raise','POST',input)).status,200);
    assert.equal((await request('state')).data.purchase_orders.filter(p=>p.indentId===indent.id).length,2);
    const duplicate={...input,revision:(await request('state')).data.revision,operationId:crypto.randomUUID()};
    assert.equal((await request('purchase-orders/raise','POST',duplicate)).status,409);
    const receive={poId:orders[0].id,revision:(await request('state')).data.revision,operationId:crypto.randomUUID()};
    const received=await request('purchase-orders/receive','POST',receive);
    assert.equal(received.status,200,JSON.stringify(received.data));
    assert.equal(received.data.purchase_orders.find(p=>p.id===orders[0].id).status,'Received');
    assert.equal(received.data.purchase_orders.find(p=>p.id===orders[1].id).status,'PO Raised');
    assert.equal(received.data.outletStock.find(b=>b.item_id===orders[0].items[0].itemId&&b.outlet_id==='brigade').quantity,3);
});

test('deployed release health and stale-browser guards protect writes without altering transactions',async()=>{
    const health=await request('health','GET',undefined,'');
    assert.equal(health.status,200);assert.equal(health.data.release.commit,testReleaseCommit);assert.equal(health.data.release.version,'1.0.0');
    const before=(await request('state')).data;
    for(const clientRelease of [null,'b'.repeat(40)]) {
        const result=await request('changes','POST',{revision:before.revision,operationId:crypto.randomUUID(),changes:[{entity:'vendors',key:'stale-vendor',value:{id:'stale-vendor',name:'Should not save'}}]},adminCookie,clientRelease);
        assert.equal(result.status,409);assert.match(result.data.error,/Refresh this page/);
    }
    const after=(await request('state')).data;
    assert.equal(after.revision,before.revision);assert.equal(after.vendors.some(v=>v.id==='stale-vendor'),false);assert.deepEqual(after.outletStock,before.outletStock);
});
