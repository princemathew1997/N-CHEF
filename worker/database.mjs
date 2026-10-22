import { entities, clone, project, fail } from './model.mjs';
import { clearHandledNotifications, updateThresholds, putRecord, notifyIssuedDeliveries } from './operations.mjs';
import { hashPassword } from './auth.mjs';
import {deliveryCounts} from './queues.mjs';

export async function readState(db,options={}) {
  const queries = entities.map(entity => entity === 'users'
    ? 'SELECT id, username, name, effective_role AS role, title, profile_json FROM users WHERE active = 1 ORDER BY created_at DESC'
    : `SELECT payload_json FROM ${entity} WHERE ${['requests', 'indents', 'purchase_orders'].includes(entity) ? 'deleted = 0' : 'active = 1'} ORDER BY rowid DESC`);
  const selected=JSON.stringify(options.recordIds || []),placeholders='SELECT value FROM json_each(?)';
  const operationalRecords=db.prepare(`SELECT kind,payload_json FROM operation_records WHERE kind NOT IN ('delivery','notification') OR
    (kind='delivery' AND (id IN (${placeholders}) OR delivery_dispatch=?)) OR
    (kind='notification' AND (id IN (${placeholders}) OR json_extract(payload_json,'$.sourceId') IN (${placeholders}) OR id LIKE 'threshold_%' OR (? AND json_extract(payload_json,'$.userId')=?)))`)
    .bind(selected,options.dispatchId || '',selected,selected,options.allNotifications?1:0,options.actor?.id || '');
  const records=options.compact?db.prepare("SELECT kind,payload_json FROM operation_records WHERE kind NOT IN ('delivery','notification') UNION ALL SELECT kind,payload_json FROM (SELECT kind,payload_json FROM operation_records WHERE kind='notification' AND json_extract(payload_json,'$.userId')=? ORDER BY rowid DESC LIMIT 200)").bind(options.actor.id):options.operational?operationalRecords:db.prepare('SELECT kind,payload_json FROM operation_records');
  const result = await db.batch([...queries.map(q => db.prepare(q)), db.prepare('SELECT id, name FROM cuisines'), db.prepare('SELECT revision FROM app_revision WHERE id = 1'), db.prepare('SELECT * FROM outlet_stock'), db.prepare('SELECT * FROM legacy_stock'), db.prepare(options.compact || options.operational?'SELECT * FROM outlet_stock_history WHERE 0':'SELECT * FROM outlet_stock_history ORDER BY created_at DESC, rowid DESC'), records]);
  const state = {};
  entities.forEach((entity, i) => {
    state[entity] = result[i].results.map(row => entity === 'users'
      ? { ...JSON.parse(row.profile_json), id: row.id, username: row.username, name: row.name, role: row.role, title: row.title }
      : JSON.parse(row.payload_json));
  });
  state.cuisines = result[entities.length].results;
  state.revision = result[entities.length + 1].results[0].revision;
  const stock = result.slice(entities.length + 2);
  state.outletStock = stock[0].results;
  state.legacyStock = stock[1].results;
  state.stockHistory = stock[2].results;
  state.operationRecords = stock[3].results.map(r=>({...JSON.parse(r.payload_json),kind:r.kind}));
  if(options.operational){
    const issued=(await db.prepare("SELECT json_extract(payload_json,'$.requestId') requestId,sum(json_extract(payload_json,'$.quantity')) quantity FROM operation_records WHERE kind='delivery' AND json_extract(payload_json,'$.replacementFor') IS NULL GROUP BY json_extract(payload_json,'$.requestId')").all()).results;
    state.issuedByRequest=Object.fromEntries(issued.filter(row=>row.requestId).map(row=>[row.requestId,row.quantity]));
  }
  return state;
}

export async function readClientState(db,actor){
  const state=await readState(db,{compact:true,actor}),result=project(state,actor);
  result.operationRecords=[...result.operationRecords.filter(record=>record.kind!=='notification'),...result.operationRecords.filter(record=>record.kind==='notification').sort((a,b)=>String(a.createdAt || '').localeCompare(String(b.createdAt || '')))];
  result.historyPaged=true;
  result.deliveryCounts=await deliveryCounts(db,actor);
  result.unreadNotificationCount=(await db.prepare("SELECT count(*) count FROM operation_records WHERE kind='notification' AND json_extract(payload_json,'$.userId')=? AND coalesce(json_extract(payload_json,'$.read'),0)=0").bind(actor.id).first()).count;
  const issued=(await db.prepare("SELECT json_extract(payload_json,'$.requestId') requestId,sum(json_extract(payload_json,'$.quantity')) quantity FROM operation_records WHERE kind='delivery' AND json_extract(payload_json,'$.replacementFor') IS NULL GROUP BY json_extract(payload_json,'$.requestId')").all()).results;
  const visible=new Set(result.requests.map(r=>r.id));
  for(const row of issued)if(visible.has(row.requestId))result.operationRecords.push({id:'issued_'+row.requestId,kind:'issued_summary',requestId:row.requestId,quantity:row.quantity});
  result.itemsWithHistory=(await db.prepare('SELECT DISTINCT item_id FROM outlet_stock_history WHERE outlet_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(result.outlets.map(outlet=>outlet.id))).all()).results.map(r=>r.item_id).filter(id=>result.items.some(i=>i.id===id));
  return result;
}

const query = (db, sql, ...values) => db.prepare(sql).bind(...values);

export async function markAllNotifications(db,actor,input,compact=true){
  const result=async()=>compact?readClientState(db,actor):project(await readState(db),actor);
  const prior=await db.prepare('SELECT actor_id FROM command_receipts WHERE id=?').bind(input.operationId).first();
  if(prior){if(prior.actor_id!==actor.id)fail('Command access denied.',403);return result();}
  const revision=(await db.prepare('SELECT revision FROM app_revision WHERE id=1').first()).revision;
  if(input.revision!==revision)fail('Data changed. Refresh and try again.',409);
  try{await db.batch([
    db.prepare('INSERT INTO revision_guards VALUES (?,?)').bind(input.operationId,revision),
    db.prepare('INSERT INTO command_receipts VALUES (?,?,?,?)').bind(input.operationId,actor.id,revision,Math.floor(Date.now()/1000)),
    db.prepare("UPDATE operation_records SET payload_json=json_set(payload_json,'$.read',json('true')) WHERE kind='notification' AND json_extract(payload_json,'$.userId')=? AND coalesce(json_extract(payload_json,'$.read'),0)=0").bind(actor.id),
    db.prepare('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,details_json) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'mark_all_read','notification',actor.id,JSON.stringify({operationId:input.operationId})),
    db.prepare('DELETE FROM revision_guards WHERE command_id=?').bind(input.operationId),
    db.prepare('UPDATE app_revision SET revision=revision+1 WHERE id=1')
  ]);}catch(error){if(/STALE_REVISION/.test(error.message))fail('Data changed. Refresh and try again.',409);throw error;}
  return result();
}

export async function persistChanges(db, state, next, touched, actor, operationId, stock = null,options={}) {
  next=clone(next);
  const writes = [
    query(db, 'INSERT INTO revision_guards VALUES (?, ?)', operationId, state.revision),
    query(db, 'INSERT INTO command_receipts (id, actor_id, expected_revision, created_at) VALUES (?, ?, ?, ?)', operationId, actor.id, state.revision, Math.floor(Date.now() / 1000)),
  ];
  // Parent records precede children. No hard deletes: historical foreign keys stay valid.
  const order = ['outlets', 'vendors', 'users', 'items', 'indents', 'requests', 'purchase_orders'];
  for (const entity of order) {
    for (const t of touched.filter(t => t.entity === entity)) {
      const { key, old, data } = t;
      if (!data) {
        writes.push(query(db, `UPDATE ${entity} SET ${['requests', 'indents', 'purchase_orders'].includes(entity) ? 'deleted' : 'active'} = ? WHERE id = ?`, ['requests', 'indents', 'purchase_orders'].includes(entity) ? 1 : 0, key));
        if (entity === 'users') writes.push(query(db, 'DELETE FROM sessions WHERE user_id = ?', key));
        continue;
      }
      if (entity === 'outlets' || entity === 'vendors') {
        writes.push(query(db, `INSERT INTO ${entity} (id, name, payload_json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload_json = excluded.payload_json`, key, data.name, JSON.stringify(data)));
        if (entity === 'outlets') writes.push(query(db, 'INSERT INTO stock_locations (id, outlet_id) VALUES (?, ?) ON CONFLICT(id) DO NOTHING', key, key));
      } else if (entity === 'users') {
        const profile = clone(data);
        const password = profile.password;
        delete profile.password;
        const existing = old ? await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(key).first() : null;
        if (!existing && !password) fail('A new user requires a password.');
        const passwordHash = password ? await hashPassword(password) : existing.password_hash;
        writes.push(query(db, 'INSERT INTO users (id, username, name, role, title, password_hash, profile_json, effective_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username = excluded.username, name = excluded.name, role = excluded.role, effective_role = excluded.effective_role, title = excluded.title, password_hash = excluded.password_hash, profile_json = excluded.profile_json', key, data.username, data.name, data.role === 'admin' ? 'admin' : data.role === 'cuisine_head' ? 'chef' : 'supervisor', data.title || '', passwordHash, JSON.stringify(profile), data.role));
        writes.push(query(db, 'DELETE FROM user_outlets WHERE user_id = ?', key), query(db, 'DELETE FROM user_cuisines WHERE user_id = ?', key));
        for (const outlet of next.outlets.filter(o => data.assignedLocations.includes('all') || data.assignedLocations.includes(o.id))) writes.push(query(db, 'INSERT INTO user_outlets VALUES (?, ?)', key, outlet.id));
        for (const cuisine of next.cuisines.filter(c => (data.assignedSections || data.assignedCuisines || []).includes(c.name))) writes.push(query(db, 'INSERT INTO user_cuisines VALUES (?, ?)', key, cuisine.id));
        if (old) writes.push(query(db, 'DELETE FROM sessions WHERE user_id = ?', key));
      } else if (entity === 'items') {
        const vendor = next.vendors.find(v => v.name === data.vendor);
        writes.push(query(db, 'INSERT INTO items (id, name, category, vendor_id, unit, payload_json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category, vendor_id = excluded.vendor_id, unit = excluded.unit, payload_json = excluded.payload_json, version = items.version + 1', key, data.name, data.category, vendor.id, data.unit, JSON.stringify(data)));
      } else if (entity === 'indents') {
        writes.push(query(db, 'INSERT INTO indents (id, indent_number, outlet_id, supervisor_id, status, payload_json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json, version = indents.version + 1, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')', key, data.indentNumber, data.outletId, data.ownerId || old?.ownerId || actor.id, data.status, JSON.stringify(data)));
        writes.push(query(db, 'DELETE FROM indent_items WHERE indent_id = ?', key));
        for (const row of data.items) writes.push(query(db, 'INSERT INTO indent_items VALUES (?, ?, ?, ?, ?)', key, row.itemId, row.originalQty, row.revisedQty, row.comment || ''));
      } else if (entity === 'requests') {
        const cuisine = next.cuisines.find(c => c.name === data.cuisine) || next.cuisines[0];
        writes.push(query(db, 'INSERT INTO requests (id, item_id, outlet_id, cuisine_id, chef_id, quantity, revised_quantity, supervisor_note, status, indent_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET quantity = excluded.quantity, revised_quantity = excluded.revised_quantity, supervisor_note = excluded.supervisor_note, status = excluded.status, indent_id = excluded.indent_id, payload_json = excluded.payload_json, version = requests.version + 1', key, data.itemId, data.outletId, cuisine.id, data.ownerId || old?.ownerId || actor.id, data.qty, data.revisedQty ?? null, data.supervisorNote || '', data.status, data.indentId || null, JSON.stringify(data)));
      } else if (entity === 'purchase_orders') {
        writes.push(query(db, 'INSERT INTO purchase_orders (id, po_number, vendor_id, indent_id, created_by, status, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json', key, data.poNumber, data.vendorId, data.indentId || null, data.ownerId || old?.ownerId || actor.id, data.status, JSON.stringify(data)));
        writes.push(query(db, 'DELETE FROM purchase_order_items WHERE purchase_order_id = ?', key));
        for (const row of data.items) writes.push(query(db, 'INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, received_quantity) VALUES (?, ?, ?, ?)', key, row.itemId, row.qty, row.receivedQty || 0));
      }
      writes.push(query(db, 'INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?)', crypto.randomUUID(), actor.id, old ? 'update' : 'create', entity, key, JSON.stringify({ operationId })));
    }
  }
  if (stock) {
    if(stock.importSummary)writes.push(query(db,'INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,details_json) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),actor.id,'legacy_import','stock',stock.importSummary.fingerprint,JSON.stringify({operationId,rows:stock.importSummary.rows})));
    for (const balance of stock.outletStock) {
      const previous = state.outletStock.find(s => s.item_id === balance.item_id && s.outlet_id === balance.outlet_id);
      if (previous?.quantity === balance.quantity && previous?.unit_cost_minor === balance.unit_cost_minor) continue;
      writes.push(query(db, 'INSERT INTO outlet_stock (item_id,outlet_id,quantity,unit_cost_minor) VALUES (?, ?, ?, ?) ON CONFLICT(item_id,outlet_id) DO UPDATE SET quantity=excluded.quantity,unit_cost_minor=excluded.unit_cost_minor', balance.item_id, balance.outlet_id, balance.quantity, balance.unit_cost_minor ?? null));
    }
    for (const legacy of stock.legacyStock) {
      if (state.legacyStock.find(s => s.item_id === legacy.item_id)?.quantity !== legacy.quantity || state.legacyStock.find(s => s.item_id === legacy.item_id)?.issue !== legacy.issue) writes.push(query(db, 'UPDATE legacy_stock SET quantity=?, issue=? WHERE item_id=?', legacy.quantity, legacy.issue, legacy.item_id));
    }
    for (const m of stock.movements) writes.push(query(db, 'INSERT INTO outlet_stock_history (id,operation_id,item_id,outlet_id,delta,quantity,kind,reason,cuisine,vendor,item_name,unit,actor_id,actor_name,unit_cost_minor,total_cost_minor,delivery_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', crypto.randomUUID(), operationId, m.item_id, m.outlet_id, m.delta, m.quantity, m.kind, m.reason, m.cuisine, m.vendor, m.item_name, m.unit, actor.id, actor.name, m.unit_cost_minor ?? null, m.total_cost_minor ?? null, m.delivery_id ?? null));
  }
  const dispatches=new Map();
  for(const delivery of stock?.deliveries || []){
    const key=JSON.stringify([delivery.outletId,delivery.cuisine,delivery.recipientId || null,delivery.replacementFor || null]);
    if(!dispatches.has(key))dispatches.set(key,crypto.randomUUID());
    const request=next.requests.find(r=>r.id===delivery.requestId),indent=next.indents.find(i=>i.id===request?.indentId);
    delivery.dispatchId=dispatches.get(key);delivery.indentId=indent?.id || null;delivery.orderRef=indent?.indentNumber || request?.id || null;
    delivery.issuedByName=actor.name;
    putRecord(next,'delivery',delivery);
  }
  notifyIssuedDeliveries(next,stock?.deliveries || []);
  updateThresholds(next, stock?.outletStock || next.outletStock);
  clearHandledNotifications(state,next,actor);
  for(const record of next.operationRecords || []) {
    const old=(state.operationRecords || []).find(r=>r.id===record.id);
    if(JSON.stringify(old)!==JSON.stringify(record)) {
      writes.push(query(db,'INSERT INTO operation_records(id,kind,payload_json) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json',record.id,record.kind,JSON.stringify(record)));
      writes.push(query(db,'INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,details_json) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),actor.id,old?'update':'create',record.kind,record.id,JSON.stringify({operationId})));
    }
  }
  for (const t of touched.filter(t => !t.data)) writes.push(query(db, 'INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(), actor.id, 'deactivate', t.entity, t.key));
  writes.push(query(db, 'DELETE FROM revision_guards WHERE command_id = ?', operationId), query(db, 'UPDATE app_revision SET revision = revision + 1 WHERE id = 1'));
  if (writes.length > 800) fail('Too many changes. Split this operation into smaller batches.');
  try { await db.batch(writes); } catch (error) {
    if (/STALE_REVISION/.test(error.message)) fail('Data changed on another device. Refresh and try again.', 409);
    if (/UNIQUE constraint failed/.test(error.message)) fail('Record already exists or command was already processed.', 409);
    if (/FOREIGN KEY constraint failed/.test(error.message)) fail('Data changed or a linked record is missing. Refresh and try again.', 409);
    throw error;
  }
  if(options.compact)return readClientState(db,actor);
  const committed = await readState(db);
  const current = committed.users.find(u => u.id === actor.id);
  if (!current) fail('Account is inactive.', 401);
  return project(committed, current);
}
