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

// All operation records are server-owned; /changes cannot write them.
export function operationCommand(state, actor, input, action, transact) {
  const next=clone(state), changes=[];
  const records=()=>next.operationRecords || [];
  const get=(kind,key)=>{const r=records().find(r=>r.kind===kind && r.id===key);if(!r)fail('Record not found.',404);return r;};
  const purchase=()=>{if(!canPurchase(actor))fail('Purchaser permission required.',403);};
  const outlet=id=>{if(!state.outlets.some(o=>o.id===id) || !hasOutlet(actor,id))fail('Outlet access denied.',403);};
  const now=new Date().toISOString();
  if(['category/add','unit/add'].includes(action)) {
    if(actor.role!=='admin')fail('Administrator permission required.',403);
    const kind=action.split('/')[0],name=safeText(input.name,'Name').trim();
    if(records().some(r=>r.kind===kind && r.name.toLowerCase()===name.toLowerCase()))fail('Name already exists.',409);
    putRecord(next,kind,{id:crypto.randomUUID(),name});
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
