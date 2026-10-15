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
    root.InventoryTools = {day,timestamp,bounds,resolveOutlet,matchItems,report,reviseCuisine};
})(globalThis);
