export const entities = ['outlets', 'vendors', 'items', 'users', 'requests', 'indents', 'purchase_orders'];
export const clone = value => JSON.parse(JSON.stringify(value));
export const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function number(value, label, positive = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value === 0) || value > 1e9) fail(`${label} must be a valid ${positive ? 'positive' : 'non-negative'} quantity.`);
  return value;
}
export function safeText(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>"'`\\\u0000-\u0008]/.test(value)) fail(`${label} is invalid. Avoid HTML, quotes, and backslashes.`);
  return value;
}
export function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value) || value === '__proto__' || value === 'constructor' || value === 'prototype') fail('Invalid record ID.');
  return value;
}
export function cleanPayload(value, depth = 0) {
  if (depth > 12) fail('Record is too deeply nested.');
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return;
  if (typeof value === 'string') {
    if (value.length > 4000 || /[<>"'`\\\u0000-\u0008]/.test(value)) fail('Text contains unsupported markup or quote characters.');
    return;
  }
  if (typeof value !== 'object') fail('Invalid record value.');
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype', 'password_hash', 'token_hash'].includes(key)) fail('Invalid record field.');
    if (key !== 'password') cleanPayload(child, depth + 1);
  }
}
export const hasOutlet = (user, outletId) => user.role === 'admin' || user.assignedLocations?.includes('all') || user.assignedLocations?.includes(outletId);
export const ownsRequest = (user, request) => request.ownerId === user.id;
export const without = (object, keys) => Object.fromEntries(Object.entries(object || {}).filter(([key]) => !keys.includes(key)));
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function project(state, user) {
  const result = clone(state);
  result.outlets = result.outlets.filter(o => hasOutlet(user, o.id));
  result.requests = result.requests.filter(r => hasOutlet(user, r.outletId) && (user.role !== 'cuisine_head' || ownsRequest(user, r)));
  result.indents = result.indents.filter(r => hasOutlet(user, r.outletId) && user.role !== 'cuisine_head');
  result.purchase_orders = result.purchase_orders.filter(r => hasOutlet(user, r.outletId) && user.role !== 'cuisine_head');
  const subordinateRoles = {purchaser:['executive_chef','cuisine_head'],executive_chef:['cuisine_head']};
  result.users = result.users.filter(u => user.role === 'admin' || u.id === user.id || (subordinateRoles[user.role]?.includes(u.role) && u.assignedLocations?.some(o => o !== 'all' && hasOutlet(user,o))));
  if(user.role!=='admin')result.users=result.users.map(u=>({...without(u,['password','password_hash']),assignedLocations:(u.assignedLocations || []).filter(o=>o!=='all' && hasOutlet(user,o))}));
  for (const item of result.items) {
    if (user.role !== 'admin') {
      const centralAvailable=(item.bought || 0)-Object.values(item.allocations || {}).reduce((sum,q)=>sum+q,0);
      item.allocations = Object.fromEntries(Object.entries(item.allocations || {}).filter(([outlet]) => hasOutlet(user, outlet)));
      item.consumed = Object.fromEntries(Object.entries(item.consumed || {}).filter(([outlet]) => hasOutlet(user, outlet)));
      // Keep other outlet allocations private; purchasing accounts can see unassigned central stock.
      item.bought = Object.values(item.allocations).reduce((sum, q) => sum + q, 0)+(user.role==='purchaser'?Math.max(0,centralAvailable):0);
    }
  }
  result.outletStock = (result.outletStock || []).filter(s => hasOutlet(user, s.outlet_id));
  result.stockHistory = (result.stockHistory || []).filter(s => s.outlet_id ? hasOutlet(user, s.outlet_id) : ['admin','purchaser'].includes(user.role));
  if (!['admin','purchaser'].includes(user.role)) result.legacyStock = [];
  result.operationRecords=(result.operationRecords || []).filter(r=>{
    if(r.kind==='notification')return r.userId===user.id;
    if(['category','unit'].includes(r.kind))return true;
    if(r.kind==='account_request')return user.role==='admin' || r.requestedBy===user.id;
    if(!hasOutlet(user,r.outletId))return false;
    if(user.role==='cuisine_head')return r.kind==='delivery' && (user.assignedSections || user.assignedCuisines || []).includes(r.cuisine) && (!r.recipientId || r.recipientId===user.id);
    return ['admin','purchaser','executive_chef'].includes(user.role);
  });
  if(user.role!=='admin') result.vendors=result.vendors.map(v=>({id:v.id,name:v.name}));
  return result;
}

export function validateRequestDate(date, justification, now = new Date()) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const earliest=new Date(Date.parse(today+'T00:00:00Z')-3*86400000).toISOString().slice(0,10);
  if(typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T00:00:00Z')) || new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date || date<earliest || date>today)fail('Request date must be today or one of the previous 3 days.');
  if(date<today && (typeof justification!=='string' || !justification.trim()))fail('A justification is required for a backdated request.');
  if(justification && (typeof justification!=='string' || justification.length>500))fail('Justification must be at most 500 characters.');
  return {date,backdated:date<today};
}

export function validateChanges(state, changes, actor, stockAction = false) {
  const next = clone(state);
  const touched = [];
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 150) fail('Submit between 1 and 150 record changes.');
  const unique = new Set();
  for (const change of changes) {
    const { entity, key, value } = change;
    if (!entities.includes(entity)) fail('Unknown record type.');
    id(key);
    if (unique.has(`${entity}:${key}`)) fail('Duplicate record change.');
    unique.add(`${entity}:${key}`);
    const old = next[entity].find(row => row.id === key);
    const data = value === null ? null : clone(value);
    if (data) { if (data.id !== key) fail('Record identity cannot change.'); cleanPayload(data); }
    if (!old && !data) fail('Record does not exist.', 404);
    if (data && entity === 'requests' && !old && !['Pending', 'Consolidated'].includes(data.status)) fail('New requests must be pending or linked to a new indent.');
    if (data && entity === 'indents' && !old && data.status !== 'Pending Approval') fail('New indents must await approval.');
    if (data && old && ['requests', 'indents', 'purchase_orders'].includes(entity)) {
      for (const field of ['itemId', 'outletId', 'cuisine', 'indentNumber', 'poNumber', 'vendorId']) {
        if (old[field] !== data[field]) fail('Record references cannot change.');
      }
    }
    if (entity === 'items') {
      if (!data) fail('Deactivate catalog items instead of deleting them.');
      if (actor.role !== 'admin') fail('Only admins can manage catalog items.', 403);
      for (const field of ['bought', 'allocations', 'consumed']) {
        const expected = old?.[field] ?? (field === 'bought' ? 0 : {});
        if (!same(data[field] ?? expected, expected)) fail('Use stock transactions to change quantities.');
        data[field] = clone(expected);
      }
      if(data.thresholdEnabled!==undefined && typeof data.thresholdEnabled!=='boolean')fail('Invalid threshold toggle.');
      if(data.thresholdEnabled===true)number(data.threshold,'Threshold');
      if(state.operationRecords)for(const field of ['category','unit']) {
        const option=state.operationRecords.find(r=>r.kind===field && r.name.toLowerCase()===String(data[field]).trim().toLowerCase());
        if(!option)fail('Choose an existing '+field+'.');data[field]=option.name;
      }
      data.name = safeText(data.name, 'Item name').trim();
      if ((!old || old.name.trim().toLowerCase() !== data.name.toLowerCase()) && next.items.some(i => i.id !== key && i.name.trim().toLowerCase() === data.name.toLowerCase())) fail('Item name already exists.', 409);
      if (data.cuisine && !next.cuisines.some(c => c.name === data.cuisine)) fail('Choose an existing cuisine.');
      if (data.active !== undefined && typeof data.active !== 'boolean') fail('Invalid active status.');
      if (old && old.unit !== data.unit && ((state.stockHistory || []).some(m => m.item_id === key) || old.bought || Object.values(old.allocations || {}).some(Boolean) || (state.legacyStock || []).some(s=>s.item_id===key && (s.quantity || s.issue)))) fail('Unit cannot change after stock transactions.');
    }
    if (!stockAction && data && ['requests','indents','purchase_orders'].includes(entity) && ((!old && ['Approved','Received','Partially Received'].includes(data.status)) || (old && old.status !== data.status && ['Approved','Received','Partially Received'].includes(data.status)))) fail('Use the approval or receiving action.');
    if (data && !old && ['requests','indents','purchase_orders'].includes(entity)) {
      const ids = entity === 'requests' ? [data.itemId] : (data.items || []).map(i => i.itemId);
      if (ids.some(itemId => next.items.find(i => i.id === itemId)?.active === false)) fail('Choose active catalog items.');
    }
    if (actor.role !== 'admin') {
      if(actor.role==='purchaser') {
        if(!['requests','indents'].includes(entity) || !old || !data || !hasOutlet(actor,old.outletId))fail('Purchaser may only edit forwarded orders.',403);
        if(!['Pending Approval','Consolidated','Sent to Admin'].includes(old.status) || old.status!==data.status)fail('Use an explicit approval action.',403);
        const fields=entity==='indents'?['items']:['qty','revisedQty','supervisorNote'];
        if(!same(without(old,fields),without(data,fields)))fail('Only order quantities and notes may change.',403);
        if(entity==='indents' && (!Array.isArray(data.items) || data.items.length!==old.items.length || data.items.some(row=>!old.items.some(prior=>prior.itemId===row.itemId && prior.originalQty===row.originalQty))))fail('Keep the forwarded order items and original quantities intact.',403);
      }

      if (actor.role==='purchaser') { /* scoped field checks above */ } else if (entity === 'requests') {
        const r = old || data;
        if (!hasOutlet(actor, r.outletId) || (old && data && old.outletId !== data.outletId)) fail('Outlet access denied.', 403);
        if (actor.role === 'cuisine_head') {
          if (old && !ownsRequest(actor, old)) fail('Request access denied.', 403);
          if (old && (old.status!=='Pending' || old.indentId)) fail('Requests accepted by the Executive Chef cannot be changed. Place a fresh request for additional quantities.', 409);
          if (data && old && !same(without(data, ['qty']), without(old, ['qty']))) fail('Chefs can only change the quantity of their request.', 403);
          if (!old && data && data.status !== 'Pending') fail('New requests must be pending.');
          const sections = actor.assignedSections || actor.assignedCuisines || [];
          if (data && !sections.includes(data.cuisine)) fail('Cuisine access denied.', 403);
        } else {
          if (old && ['Approved', 'Rejected', 'PO Raised'].includes(old.status)) fail('Completed requests cannot be changed by supervisors.', 403);
          if (data && !['Pending', 'Accepted', 'Sent to Admin', 'Consolidated', 'Rejected'].includes(data.status)) fail('Supervisors cannot approve stock.', 403);
          if (old && data && (old.itemId !== data.itemId || old.ownerId !== data.ownerId)) fail('Request identity cannot change.', 403);
        }
      } else if (entity === 'indents') {
        if (actor.role !== 'executive_chef' || !hasOutlet(actor, (old || data).outletId)) fail('Indent access denied.', 403);
        if (old && old.status !== 'Pending Approval') fail('Completed indents cannot be changed.', 409);
        if (data && (data.status !== 'Pending Approval' || (old && old.outletId !== data.outletId))) fail('Only admins can approve indents.', 403);
      } else if (entity === 'users') {
        fail('Only admins can manage accounts.',403);
      } else if (entity === 'items') {
        fail('Only admins can manage catalog items.',403);
      } else fail('Administrator permission required.', 403);
    }
    if(data && old && entity==='requests' && (data.date!==old.date || data.backdateJustification!==old.backdateJustification))fail('Request date and justification cannot change after submission.');
    if (data && entity === 'requests' && !old) {
      data.date ||= new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const requestDateCheck=validateRequestDate(data.date,data.backdateJustification);
      if(actor.role==='cuisine_head' && requestDateCheck.backdated)fail('Cuisine Head requests must use today’s date (IST).');
      data.ownerId = actor.id;
      data.requestedBy = actor.name;
      data.chefName = actor.name;
      data.timestamp = new Date().toISOString();
    }
    if(data && entity==='indents' && !old && data.status==='Pending Approval' && next.indents.some(i=>i.outletId===data.outletId && i.status==='Pending Approval'))fail('Recall the pending consolidated request for this outlet and combine it with new requests before submitting.',409);
    if (data && entity === 'indents' && !old) { data.ownerId = actor.id; data.supervisorName = actor.name; }
    if (data && entity === 'purchase_orders' && !old) { data.ownerId = actor.id; data.raisedBy = actor.name; }
    if (data && old && ['requests', 'indents', 'purchase_orders'].includes(entity)) {
      if (data.ownerId !== old.ownerId) fail('Owner cannot change.');
      if (['Approved', 'Rejected'].includes(old.status) && data.status !== old.status) fail('Completed workflow cannot be reopened.', 409);
      if (old.status === 'Approved' && !same(data, old) && !(stockAction && same(without(data,['purchaseOrderIds']),without(old,['purchaseOrderIds'])))) fail('Approved records are immutable.', 409);
    }
    if (!data && entity === 'outlets' && ((state.outletStock || []).some(s => s.outlet_id === key && s.quantity > 0) || (state.stockHistory || []).some(s => s.outlet_id === key))) fail('An outlet with stock history cannot be removed.');
    if (!data && old && ['requests', 'indents', 'purchase_orders'].includes(entity) && !['Pending', 'Accepted', 'Pending Approval'].includes(old.status)) fail('Completed records cannot be deleted.', 409);
    const index = next[entity].findIndex(row => row.id === key);
    if (data) {
      if (index < 0) next[entity].unshift(data); else next[entity][index] = data;
    } else next[entity].splice(index, 1);
    touched.push({ entity, key, old, data });
  }
  // Forwarded requests must stay attached to the indent that owns their quantities.
  if (!stockAction) for (const t of touched.filter(t => t.entity === 'requests')) {
    const linkedId = t.old?.indentId || t.data?.indentId;
    if (!linkedId) continue;
    const parent = touched.find(p => p.entity === 'indents' && p.key === linkedId);
    if (!parent) fail('Edit linked requests through their consolidated indent.', 409);
    if (!parent.data && t.data?.indentId) fail('Remove the indent link when deleting an indent.');
    if (parent.data && (!t.data || t.data.indentId !== linkedId)) fail('Keep consolidated request links intact.');
  }
  // Cross-record validation uses the resulting state, never the browser's role.
  // Keep catalog display names consistent when a vendor is renamed.
  for (const vendor of touched.filter(t => t.entity === 'vendors' && t.old && t.data && t.old.name !== t.data.name)) {
    for (const item of next.items.filter(i => i.vendor === vendor.old.name)) {
      const old = state.items.find(i => i.id === item.id);
      item.vendor = vendor.data.name;
      const existing = touched.find(t => t.entity === 'items' && t.key === item.id);
      if (existing) existing.data = item; else touched.push({ entity: 'items', key: item.id, old, data: item });
    }
  }
  const outlets = new Set(next.outlets.map(o => o.id));
  const items = new Map(next.items.map(i => [i.id, i]));
  const vendors = new Map(next.vendors.map(v => [v.name, v.id]));
  const usernames = new Set();
  for (const user of next.users) {
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(user.username || '')) fail('Usernames need 3–64 letters, digits, dots, underscores or hyphens.');
    if (usernames.has(user.username.toLowerCase())) fail('Username already exists.', 409);
    usernames.add(user.username.toLowerCase());
    if (!['admin', 'executive_chef', 'purchaser', 'cuisine_head'].includes(user.role)) fail('Invalid role.');
    safeText(user.name, 'User name');
    if (!Array.isArray(user.assignedLocations) || !user.assignedLocations.length || user.assignedLocations.some(o => o !== 'all' && !outlets.has(o))) fail('Assign valid outlets to each user.');
    if (user.role === 'cuisine_head' && !(user.assignedSections || user.assignedCuisines)?.length) fail('Assign cuisines to each chef.');
    for (const c of user.assignedSections || user.assignedCuisines || []) if (!next.cuisines.some(row => row.name === c)) fail('Unknown cuisine.');
  }
  if (!next.users.some(u => u.role === 'admin') || !next.users.some(u => u.id === actor.id)) fail('Keep an admin and your own account active.');
  for (const outlet of next.outlets) { id(outlet.id); safeText(outlet.name, 'Outlet name'); }
  for (const vendor of next.vendors) {
    safeText(vendor.name,'Vendor name');
    if(vendor.phone && !/^[+0-9 ()-]{5,25}$/.test(vendor.phone))fail('Enter a valid vendor phone number.');
    if(vendor.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(vendor.gstin))fail('Enter a valid GSTIN.');
    if(vendor.fromDate && (!/^\d{4}-\d{2}-\d{2}$/.test(vendor.fromDate) || !Number.isFinite(Date.parse(vendor.fromDate)) || new Date(vendor.fromDate).toISOString().slice(0,10)!==vendor.fromDate))fail('Choose a valid vendor-from date.');
  }
  for (const item of next.items) {
    safeText(item.name, 'Item name'); safeText(item.unit, 'Unit'); safeText(item.category, 'Category');
    if (!vendors.has(item.vendor)) fail('Choose an existing vendor.');
  }

  for (const r of next.requests) {
    if (!items.has(r.itemId) || !outlets.has(r.outletId)) fail('Unknown request item or outlet.');
    if (!['Pending', 'Accepted', 'Sent to Admin', 'Consolidated', 'Approved', 'Rejected', 'PO Raised'].includes(r.status)) fail('Invalid request status.');
    number(r.qty, 'Request quantity', true);
    if (r.revisedQty !== undefined) number(r.revisedQty, 'Revised request quantity');
    if (!next.cuisines.some(c => c.name === r.cuisine) && !['Supervisor Extra', 'Store Stock'].includes(r.cuisine)) fail('Choose a valid cuisine.');
    if (r.indentId && !next.indents.some(i => i.id === r.indentId && i.outletId === r.outletId)) fail('Invalid indent link.');
  }
  for (const indent of next.indents) {
    if (!outlets.has(indent.outletId)) fail('Unknown indent outlet.');
    safeText(indent.indentNumber, 'Indent number');
    if (!['Pending Approval', 'Approved', 'Rejected'].includes(indent.status) && !/^PO Raised \([^<>]+\)$/.test(indent.status)) fail('Invalid indent status.');
    if (!Array.isArray(indent.items) || !indent.items.length) fail('Indent needs at least one item.');
    const seen = new Set();
    for (const row of indent.items) {
      if (!items.has(row.itemId) || seen.has(row.itemId)) fail('Invalid or duplicate indent item.');
      seen.add(row.itemId); number(row.originalQty, 'Original quantity'); number(row.revisedQty, 'Revised quantity');
      const changed = touched.find(t=>t.entity==='indents' && t.key===indent.id);
      if (changed && !stockAction && row.cuisineBreakdown) {
        const linked = next.requests.filter(r=>r.indentId===indent.id && r.itemId===row.itemId);
        if(!state.indents.some(i=>i.id===indent.id) && linked.some(r=>Math.abs((r.revisedQty ?? r.qty)-r.qty)>1e-8) && !String(row.comment || '').trim())fail('A note is required for each item with edited cuisine quantities.');
        const sum = linked.reduce((total,r)=>total+(r.revisedQty ?? r.qty),0);
        if (Math.abs(sum-row.revisedQty)>1e-8) fail('Consolidated total must equal the cuisine quantities.');
        const breakdownSum = row.cuisineBreakdown.reduce((total,r)=>total+number(r.qty,'Cuisine quantity'),0);
        if (Math.abs(breakdownSum-row.revisedQty)>1e-8) fail('Cuisine breakdown must match the consolidated total.');
        const cuisines = new Set([...linked.map(r=>r.cuisine), ...row.cuisineBreakdown.map(r=>r.cuisine)]);
        for (const cuisine of cuisines) {
          const requested = linked.filter(r=>r.cuisine===cuisine).reduce((sum,r)=>sum+(r.revisedQty ?? r.qty),0);
          const displayed = row.cuisineBreakdown.filter(r=>r.cuisine===cuisine).reduce((sum,r)=>sum+r.qty,0);
          if (Math.abs(requested-displayed)>1e-8) fail('Cuisine breakdown does not match revised request quantities.');
        }

      }

    }
  }
  for (const po of next.purchase_orders) {
    if (!next.vendors.some(v => v.id === po.vendorId) || !outlets.has(po.outletId)) fail('Invalid purchase order vendor or outlet.');
    safeText(po.poNumber, 'PO number');
    if (!Array.isArray(po.items) || !po.items.length) fail('Purchase order needs items.');
    if (po.indentId && !next.indents.some(i => i.id === po.indentId && i.outletId === po.outletId)) fail('Invalid PO indent.');
    const previous = state.purchase_orders.find(p => p.id === po.id);
    if(!stockAction && !same(po.receiptEvents || [],previous?.receiptEvents || []))fail('Use purchase-order receiving to record receipt details.');
    for (const row of po.items) {
      if (!items.has(row.itemId)) fail('Unknown PO item.');
      number(row.qty, 'PO quantity', true);
      number(row.receivedQty ?? 0, 'Received quantity');
      number(row.rejectedQty ?? 0,'Rejected quantity');
      if ((row.receivedQty ?? 0) > row.qty) fail('Received quantity exceeds order quantity.');
      if (!stockAction && (row.receivedQty ?? 0) !== (previous?.items.find(r=>r.itemId===row.itemId)?.receivedQty ?? 0)) fail('Use purchase-order receiving to change received quantities.');
    }
  }
  // A newly approved indent must allocate exactly its approved quantities and
  // approve its linked requests in the same command. Partial changes roll back.
  const expectedAllocations = new Map();
  for (const t of touched.filter(t => t.entity === 'indents' && t.data?.status === 'Approved' && t.old?.status !== 'Approved')) {
    if (!t.old || t.old.status !== 'Pending Approval') fail('Indent is not awaiting approval.', 409);
    for (const row of t.data.items) {
      const key = `${row.itemId}:${t.data.outletId}`;
      expectedAllocations.set(key, (expectedAllocations.get(key) || 0) + row.revisedQty);
    }
    for (const req of next.requests.filter(r => r.indentId === t.key)) if (req.status !== 'Approved') fail('Linked requests must be approved atomically.');
  }
  for (const [key, quantity] of stockAction ? [] : expectedAllocations) {
    const split = key.lastIndexOf(':');
    const itemId = key.slice(0, split), outlet = key.slice(split + 1);
    const before = state.items.find(i => i.id === itemId)?.allocations?.[outlet] || 0;
    const after = items.get(itemId)?.allocations?.[outlet] || 0;
    const standalone = touched.filter(r => r.entity === 'requests' && r.data?.status === 'Approved' && r.old?.status !== 'Approved' && !r.data.indentId && r.data.itemId === itemId && r.data.outletId === outlet).reduce((sum, r) => sum + r.data.qty, 0);
    if (Math.abs(after - before - quantity - standalone) > 1e-8) fail('Approval stock allocation does not match the indent.');
  }
  for (const t of touched.filter(t => t.entity === 'requests' && t.data?.status === 'Approved' && t.old?.status !== 'Approved')) {
    if (!t.old) fail('Create requests before approving them.');
    const indentApproval = touched.some(i => i.entity === 'indents' && i.key === t.data.indentId && i.data?.status === 'Approved' && i.old?.status !== 'Approved');
    if (indentApproval || stockAction) continue;
    if (t.data.indentId) fail('Approve linked requests through their indent.');
    const before = state.items.find(i => i.id === t.data.itemId)?.allocations?.[t.data.outletId] || 0;
    const after = items.get(t.data.itemId)?.allocations?.[t.data.outletId] || 0;
    const total = touched.filter(r => r.entity === 'requests' && r.data?.status === 'Approved' && r.old?.status !== 'Approved' && !r.data.indentId && r.data.itemId === t.data.itemId && r.data.outletId === t.data.outletId).reduce((sum, r) => sum + r.data.qty, 0);
    const indentQty = expectedAllocations.get(`${t.data.itemId}:${t.data.outletId}`) || 0;
    if (Math.abs(after - before - total - indentQty) > 1e-8) fail('Request approval stock does not match its quantity.');
  }
  for (const t of touched.filter(t => t.entity === 'purchase_orders')) {
    if (!t.data) continue;
    if (!['PO Raised', 'Partially Received', 'Received'].includes(t.data.status)) fail('Invalid purchase order status.');
    if (t.old?.status === 'Received' && !same(t.data, t.old)) fail('Received orders cannot be changed.', 409);
    if (['Received','Partially Received'].includes(t.data.status) && stockAction) {
      if (!t.old || !same(without(t.data, ['status', 'items', 'receivedBy', 'receivedAt','receiptEvents']), without(t.old, ['status', 'items', 'receivedBy', 'receivedAt','receiptEvents']))) fail('Order details cannot change during receiving.');
      for (const line of t.data.items) {
        const previous = t.old.items.find(i => i.itemId === line.itemId);
        if (!previous || line.qty !== previous.qty || (t.data.status==='Received' && Math.abs(line.receivedQty-line.qty)>1e-8)) fail('Received quantities do not match the order.');
        const before = state.items.find(i => i.id === line.itemId);
        const after = items.get(line.itemId);
        const quantity = line.qty - (previous.receivedQty || 0);
        if (!stockAction && (Math.abs(after.bought - before.bought - quantity) > 1e-8 || Math.abs((after.allocations[t.data.outletId] || 0) - (before.allocations[t.data.outletId] || 0) - quantity) > 1e-8)) fail('Order receiving stock does not match delivery.');
      }
    }
  }
  return { next, touched };
}
