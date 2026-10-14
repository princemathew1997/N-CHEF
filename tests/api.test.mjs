import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';

let mf, db;
const origin = 'http://localhost';
const adminPassword = 'test-admin-password-2026';
const userPassword = 'test-outlet-password-2026';
let adminCookie, adminId, chefCookie, supervisorCookie, chefId, supervisorId;
async function request(path, method = 'GET', input, cookie = adminCookie) {
    const res = await mf.dispatchFetch(origin + '/api/' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: input ? JSON.stringify(input) : undefined });
    return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
async function save(changes, cookie = adminCookie, revision) {
    if (revision === undefined) revision = (await request('state', 'GET', undefined, cookie)).data.revision;
    return request('changes', 'POST', { revision, operationId: crypto.randomUUID(), changes }, cookie);
}
before(async () => {
    const bundle = await build({ entryPoints: ['worker/index.mjs'], bundle: true, format: 'esm', platform: 'browser', write: false });
    mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-14', d1Databases: ['DB'], bindings: { SETUP_TOKEN: 'test-setup-token' } }));
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
    assert.equal(unauthorized.status, 403);
    const indentId = crypto.randomUUID();
    const indent = { id: indentId, indentNumber: 'REQ-TEST-1', outletId: 'brigade', outletName: 'BRIGADE', status: 'Pending Approval', items: [{ itemId: 'item_01', originalQty: 5, revisedQty: 5, comment: '' }] };
    const consolidated = await save([{ entity: 'indents', key: indentId, value: indent }, { entity: 'requests', key: requestId, value: { ...created.data.requests[0], status: 'Consolidated', indentId } }], supervisorCookie);
    assert.equal(consolidated.status, 200, JSON.stringify(consolidated.data));
    const state = (await request('state')).data;
    const item = state.items.find(i => i.id === 'item_01');
    const approved = state.indents.find(i => i.id === indentId);
    const linked = state.requests.find(r => r.id === requestId);
    const changes = [{ entity: 'items', key: item.id, value: { ...item, allocations: { brigade: 5 } } }, { entity: 'indents', key: indentId, value: { ...approved, status: 'Approved' } }, { entity: 'requests', key: requestId, value: { ...linked, status: 'Approved' } }];
    assert.equal((await save(changes)).status, 409); // no stock yet
    assert.equal((await request('state')).data.indents[0].status, 'Pending Approval');
    assert.equal((await save([{ entity: 'items', key: item.id, value: { ...item, bought: 10 } }])).status, 200);
    changes[0].value.bought = 10;
    const before = (await request('state')).data;
    const result = await save(changes, adminCookie, before.revision);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal((await db.prepare("SELECT quantity FROM inventory_balances WHERE item_id = 'item_01' AND location_id = 'central'").first()).quantity, 5);
    assert.equal((await db.prepare("SELECT quantity FROM inventory_balances WHERE item_id = 'item_01' AND location_id = 'brigade'").first()).quantity, 5);
    const stockAction = async (path, input, cookie = adminCookie) => request(path, 'POST', { ...input, operationId: crypto.randomUUID(), revision: (await request('state', 'GET', undefined, cookie)).data.revision }, cookie);
    assert.equal((await stockAction('stock/receipt', { itemId: 'item_01', quantity: 5 })).status, 200);
    assert.equal((await stockAction('stock/receipt', { itemId: 'item_01', quantity: 5 }, supervisorCookie)).status, 403);
    assert.equal((await stockAction('stock/consume', { itemId: 'item_01', outletId: 'cafe', quantity: 1 }, supervisorCookie)).status, 403);
    assert.equal((await stockAction('stock/consume', { itemId: 'item_01', outletId: 'brigade', quantity: 6 }, supervisorCookie)).status, 409);
    assert.equal((await stockAction('stock/consume', { itemId: 'item_01', outletId: 'brigade', quantity: 2 }, supervisorCookie)).status, 200);
    assert.equal((await db.prepare("SELECT quantity FROM inventory_balances WHERE item_id = 'item_01' AND location_id = 'brigade'").first()).quantity, 3);
    const poId = crypto.randomUUID();
    const po = { id: poId, poNumber: 'PO-TEST-1', vendorId: 'v_01', outletId: 'brigade', items: [{ itemId: 'item_01', qty: 4 }], status: 'PO Raised' };
    assert.equal((await save([{ entity: 'purchase_orders', key: poId, value: po }])).status, 200);
    const poRevision = (await request('state', 'GET', undefined, supervisorCookie)).data.revision;
    const receipt = { poId, operationId: crypto.randomUUID(), revision: poRevision };
    assert.equal((await request('purchase-orders/receive', 'POST', receipt, supervisorCookie)).status, 200);
    assert.equal((await request('purchase-orders/receive', 'POST', receipt, supervisorCookie)).status, 200);
    assert.equal((await stockAction('purchase-orders/receive', { poId }, supervisorCookie)).status, 409);
    assert.equal((await db.prepare("SELECT quantity FROM inventory_balances WHERE item_id = 'item_01' AND location_id = 'brigade'").first()).quantity, 7);
    assert.equal((await request('state', 'GET', undefined, chefCookie)).data.items.find(i => i.id === 'item_01').bought, 9);
    assert.equal((await save(changes, adminCookie, before.revision)).status, 409);
    assert.equal((await db.prepare("SELECT quantity FROM inventory_balances WHERE item_id = 'item_01' AND location_id = 'brigade'").first()).quantity, 7);
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
