import { clone, fail, hasOutlet, number, safeText } from './model.mjs';

export const canPurchase = user => ['admin', 'purchaser'].includes(user.role);
export const roleNames = {admin:'Administrator',executive_chef:'Executive Chef',purchaser:'Purchaser (Supervisor)',cuisine_head:'Cuisine Head'};
export const dayIST = (date = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export function money(value) {
  number(value, 'Unit price');
  const minor = Math.round((value + Number.EPSILON) * 100);
  if (Math.abs(value * 100 - minor) > 1e-5 || !Number.isSafeInteger(minor)) fail('Prices must have at most two decimal places.');
  return minor;
}
export function lineCost(quantity, minor) {
  const result = Math.round(quantity * minor);
  if (!Number.isSafeInteger(result)) fail('Total cost exceeds the supported range.');
  return result;
}
export function putRecord(state, kind, value) {
  const rows = state.operationRecords ||= [];
  const row = {id:value.id,kind,...clone(value)};
  const index = rows.findIndex(r=>r.id===row.id);
  if(index<0) rows.push(row); else rows[index]=row;
  return row;
}
export function notify(state, roles, outletId, message, sourceId) {
  for(const user of state.users.filter(u=>roles.includes(u.role) && (!outletId || hasOutlet(u,outletId)))) {
    putRecord(state,'notification',{id:crypto.randomUUID(),userId:user.id,outletId,message,sourceId,read:false,createdAt:new Date().toISOString()});
  }
}
export function clearHandledNotifications(previous,next,actor){
  const closed=new Set();
  for(const entity of ['requests','indents','purchase_orders'])for(const row of next[entity] || []){
    const old=(previous[entity] || []).find(r=>r.id===row.id);
    if(old && old.status!==row.status && ['Accepted','Approved','Rejected','PO Raised','Consolidated','Sent to Admin','Received'].includes(row.status))closed.add(row.id);
  }
  for(const row of next.operationRecords || []){
    const old=(previous.operationRecords || []).find(r=>r.id===row.id);
    if(old && old.status!==row.status && ((row.kind==='account_request' && ['Approved','Rejected'].includes(row.status)) || (row.kind==='delivery' && ['Received','Resolved'].includes(row.status))))closed.add(row.id);
  }
  for(const notification of next.operationRecords || [])if(notification.kind==='notification' && !notification.read && closed.has(notification.sourceId) && (previous.operationRecords || []).some(r=>r.id===notification.id)){
    notification.read=true;notification.handledAt=new Date().toISOString();notification.handledBy=actor.id;
  }
}

export function updateThresholds(state, balances) {
  for(const item of state.items) for(const outlet of state.outlets) {
    const key='threshold_'+item.id+'_'+outlet.id;
    const record=state.operationRecords?.find(r=>r.id===key);
    const quantity=balances.find(b=>b.item_id===item.id && b.outlet_id===outlet.id)?.quantity || 0;
    const low=item.active!==false && item.thresholdEnabled===true && quantity<=item.threshold;
    if(low && !record?.low) notify(state,['admin'],outlet.id,`${item.name} at ${outlet.name}: ${quantity} ${item.unit} available (threshold ${item.threshold}).`,key);
    if(low || record) putRecord(state,'notification',{id:key,system:true,low});
  }
}

export function notifyIssuedDeliveries(state, deliveries) {
  for(const delivery of deliveries) {
    const recipients=state.users.filter(user=>user.role==='cuisine_head'
      && hasOutlet(user,delivery.outletId)
      && (user.assignedSections || user.assignedCuisines || []).includes(delivery.cuisine)
      && (!delivery.recipientId || delivery.recipientId===user.id));
    for(const user of recipients) {
      const notificationId=`delivery_${delivery.id}_${user.id}`;
      if((state.operationRecords || []).some(r=>r.id===notificationId))continue;
      putRecord(state,'notification',{id:notificationId,userId:user.id,outletId:delivery.outletId,eventType:'delivery_issued',sourceId:delivery.id,read:false,createdAt:delivery.createdAt,message:`${delivery.quantity} ${delivery.unit || ''} ${delivery.itemName} issued to ${delivery.cuisine}. Open Cuisine Deliveries to confirm receipt or report an issue.`});
    }
  }
}

export function recallConsolidatedRequest(state,actor,input){
  const parent=state.indents.find(i=>i.id===input.id);
  if(actor.role!=='executive_chef' || !parent || !hasOutlet(actor,parent.outletId) || parent.ownerId!==actor.id)fail('Only the owning Executive Chef can recall this request.',403);
  if(parent.status!=='Pending Approval')fail('Only an unapproved consolidated request can be recalled.',409);
  if((state.purchase_orders || []).some(p=>p.indentId===parent.id))fail('An order with purchases cannot be recalled.',409);
  const next=clone(state);
  const changes=state.requests.filter(r=>r.indentId===parent.id).map(r=>{const value={...r,status:'Accepted'};delete value.indentId;return {entity:'requests',key:r.id,value};});
  changes.push({entity:'indents',key:parent.id,value:null});
  putRecord(next,'notification',{id:crypto.randomUUID(),system:true,eventType:'indent_recall',outletId:parent.outletId,indentId:parent.id,indent:parent,recalledBy:actor.id,recalledAt:new Date().toISOString()});
  for(const n of next.operationRecords || [])if(n.kind==='notification' && n.sourceId===parent.id)n.read=true;
  notify(next,['purchaser','admin'],parent.outletId,`${actor.name} recalled ${parent.indentNumber} before approval. It will be combined with new requests and resubmitted.`,parent.id);
  return {next,changes};
}

export function reviewChefRequests(state,actor,input){
  if(actor.role!=='executive_chef')fail('Executive Chef permission required.',403);
  if(!Array.isArray(input.lines) || !input.lines.length)fail('Choose requests to review.');
  const next=clone(state),changes=[],seen=new Set(),parents=new Set();
  for(const line of input.lines){
    const request=state.requests.find(r=>r.id===line.id);
    if(!request || !hasOutlet(actor,request.outletId))fail('Request access denied.',403);
    if(seen.has(request.id))fail('Duplicate request.');
    seen.add(request.id);
    if(!['Pending','Rejected'].includes(request.status))fail('Request changed. Reopen the review.',409);
    if(line.expectedQuantity!==request.qty || line.expectedStatus!==request.status)fail('Request changed. Reopen the review.',409);
    number(line.quantity,'Reviewed quantity',true);
    if(request.indentId){
      const parent=state.indents.find(i=>i.id===request.indentId);
      if(!parent || parent.status!=='Rejected' || parent.ownerId!==actor.id || state.purchase_orders.some(p=>p.indentId===parent.id))fail('This consolidated request cannot be reopened.',409);
      parents.add(parent.id);
    }
    const value={...request,revisedQty:line.quantity,status:'Accepted',acceptedBy:actor.name,acceptedAt:new Date().toISOString()};
    delete value.indentId;
    changes.push({entity:'requests',key:value.id,value});
  }
  for(const id of parents){
    if(state.requests.some(r=>r.indentId===id && !seen.has(r.id)))fail('Review all items in the rejected consolidated request together.',409);
    putRecord(next,'notification',{id:crypto.randomUUID(),system:true,eventType:'rejected_indent_review',indent:state.indents.find(i=>i.id===id),reviewedBy:actor.id,reviewedAt:new Date().toISOString()});
    changes.push({entity:'indents',key:id,value:null});
  }
  return {next,changes};
}

export function editCuisineRequest(state,actor,input){
  if(actor.role!=='cuisine_head')fail('Cuisine Head permission required.',403);
  const request=state.requests.find(r=>r.id===input.id);
  if(!request || request.ownerId!==actor.id || !hasOutlet(actor,request.outletId))fail('Request access denied.',403);
  if(request.status!=='Pending' || request.indentId)fail('Requests accepted by the Executive Chef cannot be edited. Place a fresh request for additional quantities.',409);
  number(input.quantity,'Requested quantity',true);
  const parent=request.indentId?state.indents.find(i=>i.id===request.indentId):null;
  if(request.indentId && (!parent || parent.status!=='Pending Approval'))fail('This order is already approved or closed.',409);
  const next=clone(state),value={...request,qty:input.quantity};
  if(value.revisedQty!==undefined)value.revisedQty=input.quantity;
  const changes=[{entity:'requests',key:value.id,value}];
  if(parent){
    const linked=state.requests.filter(r=>r.indentId===parent.id && r.itemId===request.itemId).map(r=>r.id===value.id?value:r);
    const items=parent.items.map(row=>row.itemId!==request.itemId?row:{...row,originalQty:linked.reduce((n,r)=>n+r.qty,0),revisedQty:linked.reduce((n,r)=>n+(r.revisedQty ?? r.qty),0),cuisineBreakdown:[...new Set(linked.map(r=>r.cuisine))].map(cuisine=>({cuisine,qty:linked.filter(r=>r.cuisine===cuisine).reduce((n,r)=>n+(r.revisedQty ?? r.qty),0)}))});
    changes.push({entity:'indents',key:parent.id,value:{...parent,items}});
  }
  if(request.qty!==value.qty)notify(next,['executive_chef','purchaser','admin'],request.outletId,`${actor.name} changed ${request.itemName} from ${request.qty} to ${value.qty} ${request.unit || ''}.`,request.id);
  return {next,changes};
}

// All operation records are server-owned; /changes cannot write them.
export function operationCommand(state, actor, input, action, transact) {
  const next=clone(state), changes=[];
  const records=()=>next.operationRecords || [];
  const get=(kind,key)=>{const r=records().find(r=>r.kind===kind && r.id===key);if(!r)fail('Record not found.',404);return r;};
  const purchase=()=>{if(!canPurchase(actor))fail('Purchaser permission required.',403);};
  const outlet=id=>{if(!state.outlets.some(o=>o.id===id) || !hasOutlet(actor,id))fail('Outlet access denied.',403);};
  const now=new Date().toISOString();
  if(action==='requests/reject'){
    if(actor.role!=='executive_chef')fail('Executive Chef permission required.',403);
    const request=state.requests.find(r=>r.id===input.id);
    if(!request)fail('Request not found.',404);
    outlet(request.outletId);
    if(request.indentId || !['Pending','Accepted'].includes(request.status))fail('Only unforwarded requests can be rejected.',409);
    const reason=safeText(input.reason,'Rejection reason',500).trim();
    if(!reason)fail('Provide a rejection reason.');
    const value={...request,status:'Rejected',rejectReason:reason,rejectedBy:actor.name,rejectedAt:now};
    changes.push({entity:'requests',key:value.id,value});
    putRecord(next,'notification',{id:crypto.randomUUID(),userId:request.ownerId,outletId:request.outletId,message:`${actor.name} rejected ${request.itemName} (${request.qty} ${request.unit || ''}). Reason: ${reason}`,sourceId:request.id,read:false,createdAt:now});
  } else if(action==='distribution/issue'){
    purchase();
    const indent=state.indents.find(i=>i.id===input.indentId);
    if(!indent || indent.status!=='Approved')fail('Choose an approved consolidated order.',409);
    outlet(indent.outletId);
    const requests=state.requests.filter(r=>r.indentId===indent.id && r.status==='Approved');
    const remaining=r=>Math.max(0,(r.approvedQuantity ?? r.revisedQty ?? r.qty)-(r.legacyIssuedQuantity || 0)-(state.issuedByRequest?.[r.id] ?? (state.operationRecords || []).filter(d=>d.kind==='delivery' && d.requestId===r.id && !d.replacementFor).reduce((n,d)=>n+d.quantity,0)));
    const open=requests.filter(r=>remaining(r)>1e-8),seen=new Set(),decisions=[];
    if(!Array.isArray(input.lines) || !input.lines.length || input.lines.length!==open.length)fail('Include each outstanding cuisine request in this order.');
    for(const line of input.lines){
      const request=open.find(r=>r.id===line.requestId);if(!request || seen.has(line.requestId))fail('Choose unique outstanding requests from this consolidated order.');seen.add(line.requestId);
      const expected=remaining(request),quantity=number(line.quantity,'Issue quantity');
      if(quantity>expected+1e-8)fail('Issue quantity exceeds the remaining approved quantity.',409);
      const comment=String(line.comment || '').trim();if(Math.abs(quantity-expected)>1e-8 || comment)safeText(comment,'Comment for changed quantity',500);
      decisions.push({requestId:request.id,itemId:request.itemId,cuisine:request.cuisine,approvedRemaining:expected,quantity,comment});
    }
    if(!decisions.some(d=>d.quantity>0))fail('Enter a quantity greater than zero for at least one item.');
    for(const line of decisions.filter(d=>d.quantity>0))transact('distribute',{outletId:indent.outletId,itemId:line.itemId,cuisine:line.cuisine,requestId:line.requestId,quantity:line.quantity,reason:line.comment});
    putRecord(next,'notification',{id:crypto.randomUUID(),system:true,eventType:'consolidated_distribution',outletId:indent.outletId,indentId:indent.id,actorId:actor.id,createdAt:now,lines:decisions});
  } else if(['category/add','unit/add'].includes(action)) {
    if(actor.role!=='admin')fail('Administrator permission required.',403);
    const kind=action.split('/')[0],name=safeText(input.name,'Name').trim();
    if(records().some(r=>r.kind===kind && r.name.toLowerCase()===name.toLowerCase()))fail('Name already exists.',409);
    putRecord(next,kind,{id:crypto.randomUUID(),name});
  } else if(action==='notifications/read-all') {
    for(const r of records().filter(r=>r.kind==='notification' && r.userId===actor.id && !r.system && !r.read))putRecord(next,'notification',{...r,read:true});
  } else if(action==='notifications/read') {
    const r=get('notification',input.id);if(r.userId!==actor.id)fail('Notification access denied.',403);
    putRecord(next,'notification',{...r,read:true});
  } else if(action==='accounts/request') {
    if(actor.role!=='purchaser')fail('Only purchasers can request accounts.',403);
    outlet(input.outletId);
    if(!['cuisine_head','executive_chef'].includes(input.role))fail('Choose a Cuisine Head or Executive Chef.');
    const name=safeText(input.name,'Name');
    if(input.role==='cuisine_head' && !state.cuisines.some(c=>c.name===input.cuisine))fail('Choose a cuisine.');
    const r=putRecord(next,'account_request',{id:crypto.randomUUID(),name,role:input.role,outletId:input.outletId,cuisine:input.cuisine || '',requestedBy:actor.id,status:'Pending',createdAt:now});
    notify(next,['admin'],input.outletId,`Account requested for ${name} (${roleNames[input.role]}).`,r.id);
  } else if(action==='accounts/resolve') {
    if(actor.role!=='admin')fail('Administrator permission required.',403);
    const r=get('account_request',input.id);if(r.status!=='Pending')fail('Request already resolved.',409);
    if(input.approve===true) {
      if(!input.user || input.user.role!==r.role)fail('Confirm the requested account role.');
      const user={...input.user,id:crypto.randomUUID(),title:roleNames[r.role]};
      changes.push({entity:'users',key:user.id,value:user});
      putRecord(next,'account_request',{...r,status:'Approved',userId:user.id,resolvedAt:now,resolvedBy:actor.id});
    } else {
      const reason=safeText(input.reason,'Rejection reason',500);
      putRecord(next,'account_request',{...r,status:'Rejected',reason,resolvedAt:now,resolvedBy:actor.id});
    }
    putRecord(next,'notification',{id:crypto.randomUUID(),userId:r.requestedBy,outletId:r.outletId,message:`Account request for ${r.name}: ${input.approve?'Approved':'Rejected'}.`,sourceId:r.id,read:false,createdAt:now});
  } else if(action==='deliveries/accept-all') {
    if(actor.role!=='cuisine_head')fail('Cuisine Head permission required.',403);
    if(!Array.isArray(input.ids) || !input.ids.length || new Set(input.ids).size!==input.ids.length)fail('Choose the remaining deliveries.');
    let dispatch=input.dispatchId;
    for(const id of input.ids){
      const delivery=get('delivery',id);outlet(delivery.outletId);
      const group=delivery.dispatchId || delivery.id;
      if(!dispatch)dispatch=group;
      if(group!==dispatch)fail('Accept remaining items from one dispatch only.',409);
      if(!(actor.assignedSections || actor.assignedCuisines || []).includes(delivery.cuisine) || (delivery.recipientId && delivery.recipientId!==actor.id))fail('Delivery access denied.',403);
      if(delivery.status!=='Issued')fail('A delivery has already been handled. Refresh and try again.',409);
      putRecord(next,'delivery',{...delivery,status:'Received',receivedQuantity:delivery.quantity,affectedQuantity:0,reason:'',message:'',confirmedBy:actor.id,confirmedAt:now});
    }
    if(records().some(r=>r.kind==='delivery' && (r.dispatchId || r.id)===dispatch && r.status==='Issued'))fail('The dispatch changed. Refresh and review its remaining items.',409);
  } else if(action==='deliveries/confirm') {
    const r=get('delivery',input.id);outlet(r.outletId);
    if(actor.role!=='cuisine_head' || !(actor.assignedSections || actor.assignedCuisines || []).includes(r.cuisine) || (r.recipientId && r.recipientId!==actor.id))fail('Delivery access denied.',403);
    if(r.status!=='Issued')fail('Delivery already confirmed.',409);
    const received=number(input.receivedQuantity,'Received quantity');
    if(received>r.quantity)fail('Received quantity exceeds issued quantity.');
    const rejected=input.reject===true;
    if(!rejected && received!==r.quantity)fail('Report a reason for partial receipt.');
    let affected=0;
    if(rejected) {
      if(!['Less quantity','Not available','Quality issues','Other'].includes(input.reason))fail('Choose a rejection reason.');
      affected=number(input.affectedQuantity,'Affected quantity',true);
      if(affected>r.quantity)fail('Affected quantity exceeds issued quantity.');
      if(['Less quantity','Not available'].includes(input.reason) && affected!==r.quantity-received)fail('Affected quantity must equal the missing quantity.');
      if(input.reason==='Quality issues' && affected>received)fail('Quality issues cannot exceed the quantity physically received.');
      if(input.message || input.reason==='Other')safeText(input.message,'Issue message',500);
    }
    putRecord(next,'delivery',{...r,status:rejected?'Issue reported':'Received',receivedQuantity:received,affectedQuantity:affected,reason:rejected?input.reason:'',message:input.message || '',confirmedBy:actor.id,confirmedAt:now});
    if(rejected)notify(next,['admin','executive_chef','purchaser'],r.outletId,`Delivery issue: ${r.itemName} / ${r.cuisine}: ${input.reason}.`,r.id);
  } else if(action==='deliveries/resolve') {
    purchase();const r=get('delivery',input.id);outlet(r.outletId);
    if(r.status!=='Issue reported')fail('Delivery has no open issue.',409);
    const reason=safeText(input.note,'Resolution note',500);
    if(!['replacement','shortage','return','wastage'].includes(input.resolution))fail('Choose a resolution.');
    const physical=['Quality issues','Other'].includes(r.reason) && r.affectedQuantity<=r.receivedQuantity;
    if(input.resolution==='wastage' && !physical)fail('Missing stock cannot be recorded as wastage.');
    if(input.resolution==='return' && !physical)fail('Only physically returned goods can increase stock.');
    if(input.resolution==='replacement' && physical && !['return','wastage'].includes(input.disposition))fail('Choose return or wastage for the rejected goods before replacing them.');
    const disposition=input.resolution==='replacement' && physical?input.disposition:input.resolution;
    if(input.resolution==='replacement') {
      transact('distribute',{outletId:r.outletId,itemId:r.itemId,quantity:r.affectedQuantity,cuisine:r.cuisine,requestId:r.requestId,recipientId:r.recipientId,replacementFor:r.id,reason});
    }
    if(disposition==='return') {
      transact('return',{outletId:r.outletId,itemId:r.itemId,quantity:r.affectedQuantity,reason,deliveryId:r.id});
    } else if(disposition==='wastage') {
      const unitCostMinor=state.outletStock.find(b=>b.item_id===r.itemId && b.outlet_id===r.outletId)?.unit_cost_minor ?? null;
      const waste=putRecord(next,'wastage',{id:crypto.randomUUID(),deliveryId:r.id,itemId:r.itemId,itemName:r.itemName,outletId:r.outletId,cuisine:r.cuisine,quantity:r.affectedQuantity,unit:r.unit,reason,actorId:actor.id,actorName:actor.name,createdAt:now,unitCostMinor,totalCostMinor:unitCostMinor===null?null:lineCost(r.affectedQuantity,unitCostMinor)});
      notify(next,['admin'],r.outletId,`Wastage: ${r.affectedQuantity} ${r.unit} ${r.itemName}.`,waste.id);
    }
    putRecord(next,'delivery',{...r,status:'Resolved',resolution:input.resolution,disposition,resolutionNote:reason,resolvedBy:actor.id,resolvedAt:now});
  } else if(action==='receipts/reconcile') {
    purchase();outlet(input.outletId);
    if(!state.vendors.some(v=>v.name===input.vendor))fail('Choose a vendor.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || dayIST(input.date+'T00:00:00+05:30')!==input.date)fail('Choose a valid date.');
    const key='invoice_'+input.outletId+'_'+state.vendors.find(v=>v.name===input.vendor).id+'_'+input.date;
    putRecord(next,'reconciliation',{id:key,outletId:input.outletId,vendor:input.vendor,date:input.date,vendorTotalMinor:money(input.vendorTotal),updatedBy:actor.id,updatedAt:now});
  } else fail('Unknown operation.',404);
  return {next,changes};
}
