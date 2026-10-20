import { canPurchase, operationCommand } from './operations.mjs';
import { validateLegacyCSV } from '../shared/legacy-import.mjs';
import { stockCommand } from './stock.mjs';
import { releaseInfo, requireCurrentClient } from './release.mjs';
import { raiseVendorOrders } from './purchase-orders.mjs';
import { digest, equalSecret, getSessionToken, hashPassword, randomToken, sessionCookie, verifyPassword } from './auth.mjs';
import { clone, fail, hasOutlet, id, number, project, safeText, validateChanges } from './model.mjs';
import { persistChanges, readState } from './database.mjs';

function response(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('JSON content type required.', 415);
  if (Number(request.headers.get('Content-Length') || 0) > 262144) fail('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) fail('Request body required.');
  let length = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 262144) { await reader.cancel(); fail('Request is too large.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('Invalid JSON.'); }
}
async function limitLogin(db, key, limit = 15) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('INSERT INTO login_attempts (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key, now + 900, now, now).first();
  if (row.attempts > limit) fail('Too many attempts. Try again in 15 minutes.', 429);
}
async function actorFor(request, db) {
  const token = getSessionToken(request);
  if (!token) fail('Sign in to continue.', 401);
  const row = await db.prepare('SELECT users.id, users.username, users.name, users.effective_role AS role, users.title, users.profile_json FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.active = 1').bind(await digest(token), Math.floor(Date.now() / 1000)).first();
  if (!row) fail('Your session expired. Sign in again.', 401);
  return { ...JSON.parse(row.profile_json), id: row.id, username: row.username, name: row.name, role: row.role, title: row.title };
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    try {
      // Cookie-authenticated changes require same-origin JSON. There is no wildcard CORS.
      if (!['GET', 'HEAD'].includes(request.method)) {
        if (request.headers.get('Origin') !== new URL(request.url).origin) fail('Origin access denied.', 403);
      }
      if (path === '/api/health' && request.method === 'GET') {
        await env.DB.batch([
          env.DB.prepare('SELECT revision FROM app_revision WHERE id = 1'),
          env.DB.prepare('SELECT effective_role FROM users LIMIT 0'),
          env.DB.prepare('SELECT unit_cost_minor FROM outlet_stock LIMIT 0'),
          env.DB.prepare('SELECT kind FROM operation_records LIMIT 0'),
        ]);
        return response({ ok: true, release:releaseInfo(env) });
      }
      if (path === '/api/setup-status' && request.method === 'GET') {
        const first = await env.DB.prepare('SELECT id FROM setup_lock WHERE id = 1').first();
        return response({ required: !first });
      }
      if (path === '/api/setup' && request.method === 'POST') {
        const input = await body(request);
        if (!env.SETUP_TOKEN || !await equalSecret(input.setupToken || '', env.SETUP_TOKEN)) fail('Invalid setup key.', 403);
        const { username, name, password } = input;
        if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username || '')) fail('Invalid username.');
        safeText(name, 'Name');
        const hash = await hashPassword(password);
        const userId = crypto.randomUUID();
        const profile = { id: userId, username, name, role: 'admin', title: 'Administrator', assignedLocations: ['all'] };
        try {
          await env.DB.batch([
            env.DB.prepare('INSERT INTO setup_lock VALUES (1)'),
            env.DB.prepare('INSERT INTO users (id, username, name, role, title, password_hash, profile_json, effective_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(userId, username, name, 'admin', 'Administrator', hash, JSON.stringify(profile), 'admin'),
            env.DB.prepare('INSERT INTO user_outlets SELECT ?, id FROM outlets').bind(userId),
            env.DB.prepare('UPDATE app_revision SET revision = revision + 1 WHERE id = 1'),
          ]);
        } catch (error) {
          if (/UNIQUE constraint failed/.test(error.message)) fail('Administrator setup is already complete.', 409);
          throw error;
        }
        return response({ ok: true }, 201);
      }
      if (path === '/api/login' && request.method === 'POST') {
        const input = await body(request);
        const username = String(input.username || '').trim().toLowerCase();
        if (username.length > 64 || typeof input.password !== 'string' || input.password.length > 128) fail('Invalid username or password.', 401);
        await limitLogin(env.DB, await digest('ip:' + (request.headers.get('CF-Connecting-IP') || 'local')), 100);
        await limitLogin(env.DB, await digest('user:' + username));
        const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE username = ? AND active = 1').bind(username).first();
        const valid = await verifyPassword(input.password, user?.password_hash || 'pbkdf2-sha256:100000:invalid-account-salt:0000000000000000000000000000000000000000000000000000000000000000');
        if (!user || !valid) fail('Invalid username or password.', 401);
        const token = randomToken(), now = Math.floor(Date.now() / 1000);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
          env.DB.prepare('DELETE FROM login_attempts WHERE expires_at <= ?').bind(now),
          env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(await digest('user:' + username)),
          env.DB.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').bind(await digest(token), user.id, now + 28800, now),
        ]);
        const state = await readState(env.DB);
        const actor = state.users.find(u => u.id === user.id);
        return response({ user: actor, state: project(state, actor) }, 200, { 'Set-Cookie': sessionCookie(request, token) });
      }
      const actor = await actorFor(request, env.DB);
      requireCurrentClient(request, env, path);
      if (['/api/session', '/api/state'].includes(path) && request.method === 'GET') {
        const state = await readState(env.DB);
        const current = state.users.find(u => u.id === actor.id);
        if (!current) fail('Account is inactive.', 401);
        return response(path === '/api/session' ? { user: current, state: project(state, current) } : project(state, current));
      }
      if (path === '/api/revision' && request.method === 'GET') return response(await env.DB.prepare('SELECT revision FROM app_revision WHERE id=1').first());
      if (path === '/api/logout' && request.method === 'POST') {
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(getSessionToken(request))).run();
        return response({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
      }
      if (path === '/api/cuisines/add' && request.method === 'POST') {
        if (actor.role !== 'admin') fail('Administrator permission required.', 403);
        const input = await body(request); id(input.operationId);
        const prior = await env.DB.prepare('SELECT actor_id FROM command_receipts WHERE id=?').bind(input.operationId).first();
        if (prior) { if (prior.actor_id !== actor.id) fail('Command access denied.',403); return response(project(await readState(env.DB),actor)); }
        const state = await readState(env.DB);
        if (input.revision !== state.revision) fail('Data changed. Refresh and try again.',409);
        const name = safeText(input.name, 'Cuisine name').trim();
        if (state.cuisines.some(c => c.name.toLowerCase() === name.toLowerCase())) fail('Cuisine already exists.',409);
        try { await env.DB.batch([
          env.DB.prepare('INSERT INTO revision_guards VALUES (?,?)').bind(input.operationId,state.revision),
          env.DB.prepare('INSERT INTO command_receipts VALUES (?,?,?,?)').bind(input.operationId,actor.id,state.revision,Math.floor(Date.now()/1000)),
          env.DB.prepare('INSERT INTO cuisines VALUES (?,?)').bind(crypto.randomUUID(),name),
          env.DB.prepare('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'create','cuisines',name),
          env.DB.prepare('DELETE FROM revision_guards WHERE command_id=?').bind(input.operationId),
          env.DB.prepare('UPDATE app_revision SET revision=revision+1 WHERE id=1')
        ]); } catch (e) { if (/STALE_REVISION|UNIQUE constraint/.test(e.message)) fail('Data changed. Refresh and try again.',409); throw e; }
        return response(project(await readState(env.DB),actor));
      }
      if (['/api/stock/legacy-import/validate','/api/stock/legacy-import'].includes(path) && request.method === 'POST') {
        if(!canPurchase(actor))fail('Only Admin and Purchaser (Supervisor) can import legacy stock.',403);
        const input=await body(request);
        if(path==='/api/stock/legacy-import') {
          id(input.operationId);
          const prior=await env.DB.prepare('SELECT actor_id FROM command_receipts WHERE id=?').bind(input.operationId).first();
          if(prior){if(prior.actor_id!==actor.id)fail('Command access denied.',403);return response(project(await readState(env.DB),actor));}
        }
        const state=await readState(env.DB);
        const validation=validateLegacyCSV(input.csv,state,actor);
        if(validation.errors.length)return response({error:`Found ${validation.errors.length} errors. No stock has been imported.`,errors:validation.errors},422);
        const fingerprint=await digest(JSON.stringify(validation.rows.map(r=>[r.outletId,r.itemId,r.quantity,r.unitCostMinor]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
        const previous=await env.DB.prepare("SELECT id FROM audit_events WHERE action='legacy_import' AND entity_id=?").bind(fingerprint).first();
        if(previous)return response({error:'This stock sheet has already been imported. No stock has been added.',errors:[{row:1,column:'File',message:'These item, outlet, quantity and price entries were already imported. Check Stock History before entering new stock.'}]},422);
        if(path.endsWith('/validate'))return response({...validation,revision:state.revision});
        if(input.revision!==state.revision)fail('Data changed since validation. Validate the complete sheet again before importing.',409);
        const stock={outletStock:clone(state.outletStock),legacyStock:clone(state.legacyStock),movements:[],importSummary:{fingerprint,rows:validation.rows.length}};
        for(const row of validation.rows) {
          let balance=stock.outletStock.find(b=>b.item_id===row.itemId && b.outlet_id===row.outletId);
          if(!balance){balance={item_id:row.itemId,outlet_id:row.outletId,quantity:0,unit_cost_minor:null};stock.outletStock.push(balance);}
          balance.quantity+=row.quantity;
          if(balance.unit_cost_minor==null && row.unitCostMinor!==null)balance.unit_cost_minor=row.unitCostMinor;
          stock.movements.push({item_id:row.itemId,outlet_id:row.outletId,delta:row.quantity,quantity:balance.quantity,kind:'opening',reason:`Bulk legacy stock import: Excel row ${row.row}`,cuisine:'',vendor:'',item_name:row.itemName,unit:row.unit,unit_cost_minor:row.unitCostMinor,total_cost_minor:row.unitCostMinor===null?null:Math.round(row.quantity*row.unitCostMinor)});
        }
        return response(await persistChanges(env.DB,state,clone(state),[],actor,input.operationId,stock));
      }
      if (path.startsWith('/api/operations/') && request.method === 'POST') {
        const input=await body(request);id(input.operationId);
        const prior=await env.DB.prepare('SELECT actor_id FROM command_receipts WHERE id=?').bind(input.operationId).first();
        const state=await readState(env.DB);
        if(prior){if(prior.actor_id!==actor.id)fail('Command access denied.',403);return response(project(state,actor));}
        if(input.revision!==state.revision)fail('Data changed. Refresh and try again.',409);
        let stock={outletStock:clone(state.outletStock),legacyStock:clone(state.legacyStock),movements:[],deliveries:[]};
        const transact=(kind,data)=>{const result=stockCommand({...state,...stock},actor,data,kind,true);stock={...result,movements:[...stock.movements,...result.movements],deliveries:[...stock.deliveries,...(result.deliveries || [])]};};
        const derived=operationCommand(state,actor,input,path.slice('/api/operations/'.length),transact);
        let next=derived.next,touched=[];
        if(derived.changes.length){const validated=validateChanges(next,derived.changes,actor);next=validated.next;touched=validated.touched;}
        return response(await persistChanges(env.DB,state,next,touched,actor,input.operationId,stock));
      }
      if (path === '/api/purchase-orders/raise' && request.method === 'POST') {
        const input = await body(request);
        id(input.operationId);
        const prior = await env.DB.prepare('SELECT actor_id FROM command_receipts WHERE id = ?').bind(input.operationId).first();
        if (prior) {
          if (prior.actor_id !== actor.id) fail('Command access denied.',403);
          return response(project(await readState(env.DB),actor));
        }
        const state = await readState(env.DB);
        if (!Number.isSafeInteger(input.revision) || input.revision !== state.revision) fail('Data changed. Refresh and try again.',409);
        const current = state.users.find(u=>u.id===actor.id);
        if (!current) fail('Account is inactive.',401);
        const changes = raiseVendorOrders(state,current,input);
        const {next,touched} = validateChanges(state,changes,{...current,role:'admin'},true);
        return response(await persistChanges(env.DB,state,next,touched,current,input.operationId));
      }
      if (path === '/api/changes' && request.method === 'POST') {
        const input = await body(request);
        id(input.operationId);
        const prior = await env.DB.prepare('SELECT actor_id FROM command_receipts WHERE id = ?').bind(input.operationId).first();
        if (prior) {
          if (prior.actor_id !== actor.id) fail('Command access denied.', 403);
          return response(project(await readState(env.DB), actor));
        }
        const state = await readState(env.DB);
        if (!Number.isSafeInteger(input.revision) || input.revision !== state.revision) fail('Data changed on another device. Refresh and try again.', 409);
        const current = state.users.find(u => u.id === actor.id);
        if (!current) fail('Account is inactive.', 401);
        const { next, touched } = validateChanges(state, input.changes, current);
        return response(await persistChanges(env.DB, state, next, touched, current, input.operationId));
      }
      if (['/api/stock/receipt', '/api/stock/distribute', '/api/stock/adjust', '/api/stock/assign', '/api/stock/reconcile', '/api/purchase-orders/receive', '/api/indents/approve', '/api/indents/approve-all', '/api/requests/approve'].includes(path) && request.method === 'POST') {
        const input = await body(request);
        id(input.operationId);
        const prior = await env.DB.prepare('SELECT actor_id FROM command_receipts WHERE id = ?').bind(input.operationId).first();
        const state = await readState(env.DB);
        const current = state.users.find(u => u.id === actor.id);
        if (!current) fail('Account is inactive.', 401);
        if (prior) {
          if (prior.actor_id !== current.id) fail('Command access denied.', 403);
          return response(project(state, current));
        }
        if (input.revision !== state.revision) fail('Data changed on another device. Refresh and try again.', 409);
        let stock = { outletStock: clone(state.outletStock), legacyStock: clone(state.legacyStock), movements: [] };
        const transact = (kind, input) => {
          const result = stockCommand({ ...state, ...stock }, current, input, kind);
          stock = { ...result, movements: [...stock.movements, ...result.movements], deliveries:[...(stock.deliveries || []),...(result.deliveries || [])] };
        };
        const changes = [];
        const modify = (entity, data) => {
          const existing = changes.find(c => c.entity === entity && c.key === data.id);
          if (existing) existing.value = data; else changes.push({ entity, key: data.id, value: data });
        };
        const itemFor = itemId => {
          const existing = changes.find(c => c.entity === 'items' && c.key === itemId);
          const item = existing?.value || state.items.find(i => i.id === itemId);
          if (!item) fail('Item does not exist.', 404);
          return clone(item);
        };
        if (path.startsWith('/api/stock/')) {
          transact(path.split('/').pop(), input);
        } else if (path === '/api/purchase-orders/receive') {
          if (!canPurchase(current)) fail('Only admins or supervisors can receive orders.', 403);
          const po = clone(state.purchase_orders.find(p => p.id === input.poId) || null);
          if (!po || !hasOutlet(current, po.outletId)) fail('Purchase order access denied.', 403);
          if (po.status === 'Received') fail('This order has already been received.', 409);
          for (const line of po.items) {
            const quantity = line.qty - (line.receivedQty || 0);
            if (quantity <= 0) continue;
            const item = itemFor(line.itemId);
            transact('receipt', { itemId: item.id, outletId: po.outletId, quantity, unitPrice: input.prices?.[line.itemId], vendor: state.vendors.find(v => v.id === po.vendorId)?.name });
            line.receivedQty = line.qty;

          }
          po.status = 'Received'; po.receivedBy = current.name; po.receivedAt = new Date().toISOString();
          modify('purchase_orders', po);
        } else if (path === '/api/indents/approve-all') {
          if (!canPurchase(current)) fail('Purchaser permission required.', 403);
          const selected = r => hasOutlet(current, r.outletId) && (input.outletId === 'all' || r.outletId === input.outletId);
          for (const original of state.indents.filter(i => (i.status === 'Pending Approval' || i.status.startsWith('PO Raised')) && selected(i))) {
            const indent = clone(original); indent.status = 'Approved';
            modify('indents', indent);
            for (const req of state.requests.filter(r => r.indentId === indent.id)) {const line=indent.items.find(i=>i.itemId===req.itemId);const total=state.requests.filter(r=>r.indentId===indent.id && r.itemId===req.itemId).reduce((s,r)=>s+(r.revisedQty ?? r.qty),0);modify('requests', { ...req, status: 'Approved',approvedQuantity:total?line.revisedQty*(req.revisedQty ?? req.qty)/total:0 });}
          }
          for (const req of state.requests.filter(r => !r.indentId && ['Sent to Admin', 'PO Raised'].includes(r.status) && selected(r))) {
            const item = itemFor(req.itemId);
            modify('requests', { ...req, status: 'Approved',approvedQuantity:req.revisedQty ?? req.qty });
          }
          if (!changes.length) fail('No pending requests or indents to approve.', 409);
        } else {
          if (!canPurchase(current)) fail('Purchaser permission required.', 403);
          if (path === '/api/indents/approve') {
            const indent = clone(state.indents.find(i => i.id === input.indentId) || null);
            if (!indent || !(indent.status === 'Pending Approval' || indent.status.startsWith('PO Raised'))) fail('Indent is not awaiting approval.', 409);
            if (!hasOutlet(current, indent.outletId)) fail('Outlet access denied.', 403);
            indent.status = 'Approved';
            modify('indents', indent);
            for (const req of state.requests.filter(r => r.indentId === indent.id)) {const line=indent.items.find(i=>i.itemId===req.itemId);const total=state.requests.filter(r=>r.indentId===indent.id && r.itemId===req.itemId).reduce((s,r)=>s+(r.revisedQty ?? r.qty),0);modify('requests', { ...req, status: 'Approved',approvedQuantity:total?line.revisedQty*(req.revisedQty ?? req.qty)/total:0 });}
          } else {
            const req = clone(state.requests.find(r => r.id === input.requestId) || null);
            if (!req || !['Sent to Admin', 'PO Raised'].includes(req.status) || req.indentId) fail('Request is not awaiting individual approval.', 409);
            if (!hasOutlet(current, req.outletId)) fail('Outlet access denied.', 403);
            const quantity = number(input.quantity, 'Approval quantity', true);
            const item = itemFor(req.itemId);

            req.status = 'Approved'; req.approvedQuantity = quantity;
            modify('requests', req);
          }
        }
        // All changes above are derived on the server after explicit action permissions.
        const { next, touched } = changes.length ? validateChanges(state, changes, { ...current, role: 'admin' }, true) : { next: clone(state), touched: [] };
        return response(await persistChanges(env.DB, state, next, touched, current, input.operationId, stock));
      }
      fail('Endpoint not found.', 404);
    } catch (error) {
      const status = error.message?.includes('RELEASE_MAINTENANCE') ? 503 : error.status || 500;
      if (status === 500) console.error(JSON.stringify({ event: 'api_error', path, message: error.message }));
      return response({ error: status === 503 ? 'N-CHEF is being upgraded. Inventory entry is temporarily paused; please try again shortly.' : status === 500 ? 'The server could not save this operation. Please retry.' : error.message }, status);
    }
  },
};
