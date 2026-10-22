(function(root) {
    const zone = 'Asia/Kolkata';
    function day(value = new Date()) {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(value));
        const get = name => parts.find(p => p.type === name).value;
        return `${get('year')}-${get('month')}-${get('day')}`;
    }
    function timestamp(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('en-GB', { timeZone:zone, dateStyle:'medium', timeStyle:'short', hour12:true }).format(date) + ' IST';
    }
    function bounds(from, to) {
        const start = Date.parse(from + 'T00:00:00+05:30');
        const end = Date.parse(to + 'T00:00:00+05:30') + 86400000;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Choose a valid From/To date range.');
        return { start, end };
    }
    function resolveOutlet(outlets, cached) { return outlets.some(o => o.id === cached) ? cached : outlets[0]?.id || ''; }
    function matchItems(items, query) {
        const text = query.trim().toLocaleLowerCase();
        return items.filter(i => i.name.toLocaleLowerCase().includes(text));
    }
    function report(items, balances, history, outlet, from, to) {
        const {start,end} = bounds(from,to);
        const ids = new Set(items.map(i=>i.id));
        const movements = history.filter(m => m.outlet_id === outlet && ids.has(m.item_id));
        const cuisines = [...new Set(movements.filter(m => m.kind === 'distribute' && Date.parse(m.created_at)>=start && Date.parse(m.created_at)<end).map(m => m.cuisine || 'Unspecified'))].sort();
        const byItem = new Map();
        for (const movement of movements) {
            if (!byItem.has(movement.item_id)) byItem.set(movement.item_id, []);
            byItem.get(movement.item_id).push(movement);
        }
        const balanceByItem = new Map(balances.filter(b=>b.outlet_id===outlet).map(b=>[b.item_id,b.quantity]));
        const rows = items.map(item => {
            const entries = byItem.get(item.id) || [];
            const period = entries.filter(m => Date.parse(m.created_at)>=start && Date.parse(m.created_at)<end);
            const remaining = (balanceByItem.get(item.id) || 0) - entries.filter(m=>Date.parse(m.created_at)>=end).reduce((sum,m)=>sum+m.delta,0);
            const opening = remaining - period.filter(m=>m.kind!=='opening').reduce((sum,m)=>sum+m.delta,0);
            const received = period.filter(m=>['receipt','assign'].includes(m.kind)).reduce((sum,m)=>sum+m.delta,0);
            const adjustments = period.filter(m=>m.kind==='adjust').reduce((sum,m)=>sum+m.delta,0);
            const usage = Object.fromEntries(cuisines.map(c => [c, -period.filter(m=>m.kind==='distribute' && (m.cuisine || 'Unspecified')===c).reduce((sum,m)=>sum+m.delta,0)]));
            return {item,opening,received,adjustments,remaining,usage,activity:period.length};
        }).filter(r=>Math.abs(r.opening)>1e-8 || r.activity || Math.abs(r.remaining)>1e-8);
        return {rows,cuisines};
    }
    function reviseCuisine(entry, cuisine, quantity) {
        if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Invalid cuisine quantity.');
        const requests = entry.chefRequests.filter(r => r.cuisine.toLowerCase() === cuisine.toLowerCase());
        if (!requests.length) throw new Error('Cuisine has no requests for this item.');
        const weights = requests.map(r => r.revisedQty ?? r.qty);
        const sum = weights.reduce((s,q)=>s+q,0);
        let remaining = quantity;
        requests.forEach((r,index)=>{
            const value = index === requests.length-1 ? remaining : quantity*(sum ? weights[index]/sum : 1/requests.length);
            r.revisedQty = value; remaining -= value;
        });
        entry.revisedQty = entry.chefRequests.reduce((s,r)=>s+(r.revisedQty ?? r.qty),0);
    }
    function distributionRequests(requests,records,itemId,outletId,cuisine) {
        return requests.filter(r=>r.status==='Approved' && r.itemId===itemId && r.outletId===outletId && r.cuisine===cuisine).map(r=>{
            const issued=(r.legacyIssuedQuantity || 0)+records.filter(d=>['delivery','issued_summary'].includes(d.kind) && d.requestId===r.id && !d.replacementFor).reduce((sum,d)=>sum+d.quantity,0);
            return {...r,remainingQuantity:Math.max(0,(r.approvedQuantity ?? r.revisedQty ?? r.qty)-issued)};
        });
    }
    function consolidationNote(requests) {
        return [...new Set(requests.map(r=>r.supervisorNote).filter(note=>typeof note==='string' && note.trim()).map(note=>note.trim()))].join('; ');
    }
    function workspaceEditChanges(items,requests,snapshots,outletId,indents){
        if(indents.some(i=>i.outletId===outletId && i.status==='Pending Approval'))throw new Error('Recall the pending consolidated request before saving edits.');
        const changes=[];
        for(const item of items)for(const row of item.chefRequests || []){
            const current=requests.find(r=>r.id===row.id);
            if(!current || snapshots.get(row.id)!==JSON.stringify(current) || !['Pending','Accepted'].includes(current.status) || current.indentId || current.outletId!==outletId)throw new Error('A request changed. Reopen Consolidate Request before saving.');
            const quantity=row.revisedQty ?? row.qty;
            if(!Number.isFinite(quantity) || quantity<0)throw new Error('Enter a non-negative quantity.');
            const value={...current,revisedQty:quantity,supervisorNote:String(item.comment || '').trim()};
            if(JSON.stringify(value)!==JSON.stringify(current))changes.push({entity:'requests',key:current.id,value});
        }
        return changes;
    }
    function menuAttention(state,user){
        const purchasing=['admin','purchaser'].includes(user.role),executive=user.role==='executive_chef';
        const requests=state.requests || [],indents=state.indents || [],records=state.operationRecords || [];
        const deliveries=state.deliveryCounts?(user.role==='cuisine_head'?state.deliveryCounts.awaiting:purchasing?state.deliveryCounts.issues:0):records.filter(r=>r.kind==='delivery' && (user.role==='cuisine_head'?r.status==='Issued':purchasing?r.status==='Issue reported':false)).length;
        return {approvals:purchasing?indents.filter(i=>i.status==='Pending Approval').length+requests.filter(r=>!r.indentId && r.status==='Sent to Admin').length:0,
            manage:executive?requests.filter(r=>r.status==='Pending').length:0,
            consolidate:executive?requests.filter(r=>r.status==='Accepted' && !r.indentId).length:0,
            vendorOrders:purchasing?indents.filter(i=>i.status==='Approved' && !i.purchaseOrderIds?.length).length:0,
            deliveries,accounts:user.role==='admin'?records.filter(r=>r.kind==='account_request' && r.status==='Pending').length:0};
    }
    function purchaseOrderList(orders,section,from='',to=''){
        if(from && to && from>to)throw new Error('From date must be on or before To date.');
        const date=po=>{const value=section==='received'?po.receivedAt:po.createdAt || po.date;return value?day(value):'';};
        return orders.filter(po=>(section==='received'?po.status==='Received':po.status!=='Received') && (!from || date(po)>=from) && (!to || (date(po) && date(po)<=to))).sort((a,b)=>date(b).localeCompare(date(a)));
    }
    function consolidatedDistributionRows(state,indentId){
        const indent=(state.indents || []).find(i=>i.id===indentId && i.status==='Approved');
        if(!indent)return [];
        return (state.requests || []).filter(r=>r.indentId===indentId && r.status==='Approved').map(r=>{
            const issued=(r.legacyIssuedQuantity || 0)+(state.operationRecords || []).filter(d=>['delivery','issued_summary'].includes(d.kind) && d.requestId===r.id && !d.replacementFor).reduce((n,d)=>n+d.quantity,0);
            const remaining=Math.max(0,(r.approvedQuantity ?? r.revisedQty ?? r.qty)-issued);
            return {...r,remaining,available:(state.outletStock || []).find(b=>b.item_id===r.itemId && b.outlet_id===indent.outletId)?.quantity || 0};
        }).filter(r=>r.remaining>1e-8);
    }
    function defaultDistributionAllocations(rows){
        const availableByItem=new Map();
        return rows.map(row=>{
            const available=availableByItem.has(row.itemId)?availableByItem.get(row.itemId):Math.max(0,Number(row.available) || 0);
            const quantity=Math.min(Math.max(0,Number(row.remaining) || 0),available);
            availableByItem.set(row.itemId,available-quantity);
            return quantity;
        });
    }
    root.InventoryTools = {defaultDistributionAllocations,consolidatedDistributionRows,purchaseOrderList,menuAttention,workspaceEditChanges,consolidationNote,distributionRequests,day,timestamp,bounds,resolveOutlet,matchItems,report,reviseCuisine};
})(globalThis);
