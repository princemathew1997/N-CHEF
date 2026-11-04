(() => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money = value => value==null?'—':(value/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
    const day = offset => InventoryTools.day(new Date(Date.now()-offset*86400000).toISOString());
    const filters = {from:day(89),to:day(0),outlet:'',vendor:'',category:'',item:''};
    const table = (headers,rows) => `<div class="table-container"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">No purchases in this period.</td></tr>`}</tbody></table></div>`;
    const options = (rows,value,label) => '<option value="">All</option>'+rows.map(r=>`<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');
    const outletName = id => outletsData.find(o=>o.id===id)?.name || id;
    let sequence=0;
    function chart(points,unit,from,to) {
        if(!points.length)return '<p>No purchases in this period.</p>';
        const colors=['#2563eb','#dc2626','#059669','#9333ea','#b45309','#0891b2'];
        const start=Date.parse(from),end=Date.parse(to),max=Math.max(...points.map(p=>p.priceMinor),1);
        const x=d=>65+(Date.parse(d)-start)/Math.max(end-start,86400000)*690;
        const y=p=>245-p/max*205;
        const groups=new Map();
        points.forEach(p=>{const key=JSON.stringify([p.outletId,p.vendor]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);});
        let drawing='',legend='';
        [...groups.values()].forEach((rows,index)=>{
            const color=colors[index%colors.length],label=outletName(rows[0].outletId)+' / '+rows[0].vendor;
            legend+=`<li><span style="color:${color}">●</span> ${esc(label)}</li>`;
            rows.forEach((p,i)=>{
                const previous=rows[i-1];
                // Only connect consecutive purchase days: missing dates remain gaps.
                if(previous && Date.parse(p.day)-Date.parse(previous.day)===86400000)drawing+=`<line x1="${x(previous.day)}" y1="${y(previous.priceMinor)}" x2="${x(p.day)}" y2="${y(p.priceMinor)}" stroke="${color}" stroke-width="2"/>`;
                drawing+=`<circle cx="${x(p.day)}" cy="${y(p.priceMinor)}" r="4" fill="${color}"><title>${esc(p.day+' · '+label+' · '+money(p.priceMinor)+' / '+unit)}</title></circle>`;
            });
        });
        return `<p>Daily quantity-weighted purchase price (INR / ${esc(unit)}). Days without purchases are gaps.</p><svg viewBox="0 0 800 290" role="img" aria-label="Daily purchase prices by outlet and vendor" fill="currentColor" style="width:100%;min-width:0"><line x1="65" y1="245" x2="755" y2="245" stroke="currentColor"/><text x="2" y="45" font-size="12">${esc(money(max))}</text><text x="10" y="245" font-size="12">₹0</text><text x="65" y="275" font-size="12">${esc(from)}</text><text x="755" y="275" text-anchor="end" font-size="12">${esc(to)}</text>${drawing}</svg><ul>${legend}</ul>`;
    }
    window.PriceHistory = {render(content) {
        const token=++sequence;
        content.innerHTML=`<p>Recorded purchase prices in INR per catalog unit. Dates use IST.</p><form class="inventory-form">
          <label>Period<select name="period"><option value="90">Last 90 days</option><option value="30">Last 30 days</option><option value="365">Last year</option><option value="custom">Custom range</option></select></label>
          <label>From<input type="date" name="from" required></label><label>To<input type="date" name="to" required></label>
          <label>Outlet<select name="outlet">${options(OutletSelection.allowed(),o=>o.id,o=>o.name)}</select></label>
          <label>Vendor<select name="vendor">${options(vendorsData,v=>v.name,v=>v.name)}</select></label>
          <label>Category<select name="category">${options([...new Set(masterItemsData.map(i=>i.category))].sort(),v=>v,v=>v)}</select></label>
          <label>Item<select name="item">${options(masterItemsData,i=>i.id,i=>i.name)}</select></label>
          <button class="btn btn-primary">Apply filters</button></form><div data-price-results aria-live="polite"></div>`;
        const form=content.querySelector('form'),results=content.querySelector('[data-price-results]');
        Object.entries(filters).forEach(([key,value])=>form.elements[key].value=value);
        form.elements.period.value=filters.to===day(0) && filters.from===day(89)?'90':'custom';
        form.elements.period.onchange=()=>{const n=Number(form.elements.period.value);if(n){form.elements.from.value=day(n-1);form.elements.to.value=day(0);}};
        ['from','to'].forEach(key=>form.elements[key].onchange=()=>form.elements.period.value='custom');
        let requestSequence=0;
        async function load(itemId='',cursor='',append=false) {
            const requestToken=++requestSequence;
            results.setAttribute('aria-busy','true');
            if(!append)results.innerHTML='<p>Loading prices…</p>';
            try {
                const query=new URLSearchParams(filters);if(itemId)query.set('item',itemId);if(cursor)query.set('cursor',cursor);
                const data=await apiRequest((itemId?'prices/item?':'prices?')+query);
                if(token!==sequence || requestToken!==requestSequence || !content.isConnected)return;
                if(!itemId) {
                    results.innerHTML=table(['Item','Unit','Latest price','Latest purchase (IST)','Previous price','Change','Minimum','Maximum','Weighted average'],data.items.map(i=>[
                        `<button type="button" class="btn btn-outline" data-price-item="${esc(i.id)}">${esc(i.name)}</button>`,esc(i.unit),i.receiptCount?money(i.latestPriceMinor):'No purchases in this period.',i.latestAt?esc(InventoryTools.timestamp(i.latestAt)):'—',money(i.previousPriceMinor),i.changePercent==null?'—':esc(i.changePercent.toFixed(2)+'%'),money(i.minPriceMinor),money(i.maxPriceMinor),money(i.averagePriceMinor)]));
                    results.querySelectorAll('[data-price-item]').forEach(b=>b.onclick=()=>load(b.dataset.priceItem));
                } else {
                    const receiptRows=data.rows.map(r=>[esc(InventoryTools.timestamp(r.created_at)),esc(outletName(r.outlet_id)),esc(r.vendor),esc(r.delta+' '+r.unit),money(r.unit_cost_minor),money(r.total_cost_minor)]);
                    if(append)results.querySelector('tbody').insertAdjacentHTML('beforeend',receiptRows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join(''));
                    else results.innerHTML=`<button type="button" class="btn btn-outline" data-price-back>Back to overview</button><h2>${esc(data.item.name)}</h2><p>Latest: ${money(data.item.latestPriceMinor)} · Previous: ${money(data.item.previousPriceMinor)} · Change: ${data.item.changePercent==null?'—':esc(data.item.changePercent.toFixed(2)+'%')} · Minimum: ${money(data.item.minPriceMinor)} · Maximum: ${money(data.item.maxPriceMinor)} · Weighted average: ${money(data.item.averagePriceMinor)}</p>${chart(data.daily,data.item.unit,data.from,data.to)}${table(['Date/time (IST)','Outlet','Vendor','Received quantity','Unit price','Line total'],receiptRows)}<div data-price-pagination></div>`;
                    results.querySelector('[data-price-back]').onclick=()=>load();
                    const pagination=results.querySelector('[data-price-pagination]');pagination.innerHTML=data.nextCursor?'<button type="button" class="btn btn-outline">Load more receipts</button>':'';
                    if(data.nextCursor)pagination.querySelector('button').onclick=e=>{e.target.disabled=true;load(itemId,data.nextCursor,true);};
                }
            } catch(e) {
                if(token!==sequence || requestToken!==requestSequence)return;
                if(!append)results.innerHTML='';
                results.insertAdjacentHTML('beforeend',`<p role="alert">${esc(e.message)}</p><button type="button" data-price-retry>Retry</button>`);
                results.querySelector('[data-price-retry]').onclick=()=>load(itemId,cursor,append);
            } finally {if(requestToken===requestSequence)results.setAttribute('aria-busy','false');}
        }
        form.onsubmit=e=>{e.preventDefault();Object.keys(filters).forEach(k=>filters[k]=form.elements[k].value);load();};
        load();
    }};
})();
