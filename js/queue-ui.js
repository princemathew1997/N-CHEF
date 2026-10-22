// Paginated operational queues. History stays on the server until requested.
(() => {
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const table=(headers,rows)=>`<div class="table-container"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">No records match these filters.</td></tr>`}</tbody></table></div>`;
    const options=(rows,label=r=>r.name,value=r=>r.id)=>rows.map(r=>`<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');
    const outletName=id=>outletsData.find(o=>o.id===id)?.name || id;
    const person=id=>usersData.find(u=>u.id===id)?.name || 'Earlier account';
    const today=()=>InventoryTools.day();
    const rows=new Map();
    let owner=null,deliveryFilters,historyFilters,deliveryRender=0,historyRender=0;
    let refreshDeliveries,refreshHistory;
    function resetOwner(){
        if(owner===currentUser.id)return;
        owner=currentUser.id;rows.clear();
        deliveryFilters={view:'attention',outlet:'',cuisine:'',status:'',item:'',order:'',from:'',to:''};
        historyFilters={outlet:'',item:'',vendor:'',type:'',person:'',from:today(),to:today()};
    }
    function outletControl(){
        const outlets=OutletSelection.allowed();
        return outlets.length===1?`<span class="fixed-outlet">${esc(outlets[0].name)}</span>`:`<label>Outlet<select name="outlet"><option value="">All assigned outlets</option>${options(outlets)}</select></label>`;
    }
    function query(filters,cursor){const params=new URLSearchParams({...filters,limit:25});if(cursor)params.set('cursor',cursor);return params;}
    function filterValues(form,filters){for(const [key,value] of new FormData(form))filters[key]=value;}
    function age(when){const hours=Math.max(0,Math.floor((Date.now()-Date.parse(when))/3600000));return hours>=24?`${Math.floor(hours/24)}d ${hours%24}h`:`${hours}h`;}
    function dispatchCard(dispatch,chef){
        return `<section class="approval-request-card operations-card dispatch-card" data-dispatch="${esc(dispatch.dispatchId)}">
          <header class="approval-request-header"><div><small>${dispatch.earlierDelivery?'Earlier delivery':'Dispatch'}</small>
          <h3>${esc(outletName(dispatch.outletId))} / ${esc(dispatch.cuisine)}</h3>
          <p>${esc(InventoryTools.timestamp(dispatch.createdAt))} · ${dispatch.itemCount} item(s)</p>
          <p>Issued by ${esc(dispatch.issuedByName || person(dispatch.issuedBy))} · Recipient: ${dispatch.recipientId?esc(dispatch.recipientName || person(dispatch.recipientId)):'Assigned Cuisine Heads'}</p>
          ${dispatch.orderRef?`<p>Order: ${esc(dispatch.orderRef)}</p>`:''}</div><div>
          ${dispatch.awaiting?`<p>${dispatch.awaiting} awaiting</p>`:''}
          ${dispatch.awaiting || dispatch.issues?`<p>Waiting ${esc(age(dispatch.createdAt))}</p>`:''}
          ${dispatch.issues?`<p class="queue-issue">${dispatch.issues} issue(s) to resolve</p>`:''}
          ${!dispatch.awaiting && !dispatch.issues?'<span class="status ok">Completed</span>':''}</div></header>
          <div class="approval-request-actions"><button type="button" class="btn btn-outline" data-expand-dispatch="${esc(dispatch.dispatchId)}">View items</button>
          ${chef && dispatch.awaiting?`<button type="button" class="btn btn-primary" data-action="accept-dispatch" data-id="${esc(dispatch.dispatchId)}">Accept all remaining (${dispatch.awaiting})</button>`:''}</div>
          <div class="dispatch-items hidden"></div></section>`;
    }
    function pager(container,hasPrevious,next,onPrevious,onNext){
        container.innerHTML=`<button type="button" class="btn btn-outline" data-prev ${hasPrevious?'':'disabled'}>Previous</button><button type="button" class="btn btn-outline" data-next ${next?'':'disabled'}>Next</button>`;
        container.querySelector('[data-prev]').onclick=onPrevious;container.querySelector('[data-next]').onclick=onNext;
    }
    async function allDispatchRows(dispatch){
        let cursor=null;const result=[];
        do{const page=await apiRequest('dispatches/items?'+new URLSearchParams({dispatch,limit:100,...(cursor?{cursor}:{})}));result.push(...page.rows);cursor=page.nextCursor;}while(cursor);
        return result;
    }
    async function renderDeliveries(content){
        resetOwner();const filters=deliveryFilters,renderId=++deliveryRender;let cursor=null,previous=[],generation=0;
        const chef=currentUser.role==='cuisine_head';
        content.innerHTML=`<div class="queue-counts" aria-live="polite"></div><div class="purchase-order-tabs">${[['attention','Needs attention'],['today','Today'],['history','History']].map(([value,label])=>`<button type="button" class="btn ${filters.view===value?'btn-primary':'btn-outline'}" data-queue-view="${value}">${label}</button>`).join('')}</div><details class="queue-filter-panel"><summary>Filters</summary><form class="queue-filters">${outletControl()}<label>Cuisine<select name="cuisine"><option value="">All assigned cuisines</option>${options(cuisinesData.filter(c=>!chef || (currentUser.assignedSections || currentUser.assignedCuisines || []).includes(c.name)),c=>c.name,c=>c.name)}</select></label><label>Status<select name="status"><option value="">All statuses</option>${options(['Issued','Issue reported','Received','Resolved'],r=>r,r=>r)}</select></label><label>Item<div data-queue-item></div></label><label>Order reference<input name="order" placeholder="Order / request reference"></label><label>From (IST)<input type="date" name="from"></label><label>To (IST)<input type="date" name="to"></label><button type="submit" class="btn btn-outline">Apply filters</button></form></details><p class="text-muted">${chef?'Report issues item by item, then accept the remaining items in that delivery.':'Follow up on awaiting confirmations and resolve reported issues.'} Needs attention includes unfinished deliveries from earlier days. Counts cover your assigned scope.</p><div data-dispatch-cards aria-live="polite"></div><div class="queue-pager"></div>`;
        const form=content.querySelector('form'),cards=content.querySelector('[data-dispatch-cards]');
        content.querySelector('summary').textContent='Filters'+(Object.entries(filters).some(([key,value])=>key!=='view' && value)?' (applied)':'');
        for(const [name,value] of Object.entries(filters))if(form.elements[name])form.elements[name].value=value;
        createItemPicker(form.querySelector('[data-queue-item]'),masterItemsData,{optional:true,selected:filters.item,onChange:value=>filters.item=value});
        async function load(){
            const expanded=[...cards.querySelectorAll('.dispatch-items:not(.hidden)')].map(node=>node.closest('[data-dispatch]').dataset.dispatch);
            const token=++generation;cards.textContent='Loading deliveries…';
            try{
                const result=await apiRequest('dispatches?'+query(filters,cursor));if(token!==generation || renderId!==deliveryRender || !content.isConnected)return;
                const c=result.counts;content.querySelector('.queue-counts').innerHTML=`<span>Awaiting confirmation <strong>${c.awaiting}</strong></span><span>Issues to resolve <strong>${c.issues}</strong></span><span>Completed today <strong>${c.completedToday}</strong></span>`;
                const ordered=filters.view==='attention' && !chef?result.rows.slice().sort((a,b)=>Number(b.issues>0)-Number(a.issues>0)):result.rows;
                cards.innerHTML=ordered.map(dispatch=>dispatchCard(dispatch,chef)).join('') || '<p>No deliveries match these filters.</p>';
                cards.querySelectorAll('[data-expand-dispatch]').forEach(button=>button.onclick=()=>expand(button));
                cards.querySelectorAll('[data-expand-dispatch]').forEach(button=>{if(expanded.includes(button.dataset.expandDispatch))expand(button);});
                pager(content.querySelector('.queue-pager'),previous.length,result.nextCursor,()=>{cursor=previous.pop();load();},()=>{previous.push(cursor);cursor=result.nextCursor;load();});
            }catch(error){if(token===generation && renderId===deliveryRender)cards.textContent=error.message;}
        }
        async function expand(button){
            const target=button.closest('section').querySelector('.dispatch-items');
            if(!target.classList.contains('hidden')){target.classList.add('hidden');button.textContent='View items';return;}
            target.classList.remove('hidden');button.textContent='Hide items';target.textContent='Loading items…';
            let next=null;
            const loadItems=async append=>{
                try{
                    const result=await apiRequest('dispatches/items?'+new URLSearchParams({dispatch:button.dataset.expandDispatch,limit:25,...(next?{cursor:next}:{})}));
                    if(!target.isConnected || renderId!==deliveryRender)return;
                    result.rows.forEach(row=>rows.set(row.id,row));
                    const html=table(['Item','Issued / received','Status / issue','Action'],result.rows.map(d=>[esc(`${d.itemName} (${d.unit || ''})`),esc(`${d.quantity} / ${d.receivedQuantity ?? 'Awaiting'}`),esc([d.status,d.reason,d.message,d.resolutionNote,d.issueComment].filter(Boolean).join(' · ')),`${chef && d.status==='Issued'?`<button class="btn btn-outline" data-action="confirm-delivery" data-id="${esc(d.id)}">Confirm / report issue</button>`:['admin','purchaser'].includes(currentUser.role) && d.status==='Issue reported'?`<button class="btn btn-outline" data-action="resolve-delivery" data-id="${esc(d.id)}">Resolve issue</button>`:''}${d.requestId?` <button type="button" class="btn btn-outline" data-view-request="${esc(d.id)}">View request</button>`:''}${!chef?` <button type="button" class="btn btn-outline" data-view-movement="${esc(d.id)}">Stock movement</button>`:''}`]));
                    if(!append)target.innerHTML='';target.querySelector('[data-more-items]')?.remove();target.insertAdjacentHTML('beforeend',html);next=result.nextCursor;
                    if(next){const more=document.createElement('button');more.type='button';more.className='btn btn-outline';more.dataset.moreItems='';more.textContent='More items';more.onclick=()=>loadItems(true);target.append(more);}
                    target.querySelectorAll('[data-view-request]').forEach(b=>b.onclick=()=>{const d=rows.get(b.dataset.viewRequest),r=requestsData.find(r=>r.id===d.requestId);window.showUiModal({title:'Originating request',message:r?`${r.itemName} · ${r.date || InventoryTools.day(r.timestamp)} · Requested: ${r.qty} ${r.unit || ''} · Approved: ${r.approvedQuantity ?? r.revisedQty ?? r.qty} · ${r.status}`:`Request reference: ${d.requestId}`,type:'info'});});
                    target.querySelectorAll('[data-view-movement]').forEach(b=>b.onclick=()=>{historyFilters={outlet:'',item:'',vendor:'',type:'',person:'',from:'',to:'',delivery:b.dataset.viewMovement,allDates:'1'};window.switchToView('inventory:history');});
                }catch(error){target.textContent=error.message;}
            };await loadItems(false);
        }
        form.onsubmit=event=>{event.preventDefault();filterValues(form,filters);if(filters.from && filters.to && filters.from>filters.to){window.showToast('From date must be on or before To date.','warning');return;}cursor=null;previous=[];content.querySelector('.queue-filter-panel').open=false;load();};
        content.querySelectorAll('[data-queue-view]').forEach(button=>button.onclick=()=>{filters.view=button.dataset.queueView;filters.from=filters.to=filters.view==='today'?today():'';renderDeliveries(content);});
        refreshDeliveries=load;await load();
    }
    async function renderHistory(content){
        resetOwner();const filters=historyFilters,renderId=++historyRender;let cursor=null,previous=[],generation=0;
        content.innerHTML=`<details class="queue-filter-panel"><summary>Filters</summary><form class="queue-filters">${outletControl()}<label>Item<div data-history-item></div></label><label>Vendor<select name="vendor"><option value="">All vendors</option>${options(vendorsData,r=>r.name,r=>r.name)}</select></label><label>Movement<select name="type"><option value="">All movements</option>${options(['receipt','distribute','adjust','opening','assign','return'],r=>r,r=>r)}</select></label><label>Person<select name="person"><option value="">All people</option>${options(usersData)}</select></label><label>From (IST)<input type="date" name="from"></label><label>To (IST)<input type="date" name="to"></label><button type="submit" class="btn btn-outline">Apply filters</button><button type="button" class="btn btn-outline" data-history-today>Today</button></form></details><div data-history-rows aria-live="polite"></div><div class="queue-pager"></div>`;
        const form=content.querySelector('form'),target=content.querySelector('[data-history-rows]');
        content.querySelector('summary').textContent='Filters · '+(filters.from===today() && filters.to===today()?'Today (IST)':'Selected range');
        for(const [name,value] of Object.entries(filters))if(form.elements[name])form.elements[name].value=value;
        createItemPicker(form.querySelector('[data-history-item]'),masterItemsData,{optional:true,selected:filters.item,onChange:value=>filters.item=value});
        async function load(){const token=++generation;target.textContent='Loading stock movements…';try{
            const result=await apiRequest('stock/history?'+query(filters,cursor));if(token!==generation || renderId!==historyRender || !content.isConnected)return;
            target.innerHTML=table(['Date','Outlet','Item','Movement','Change','Balance','Unit','Cuisine','Vendor','Reason','Person'],result.rows.map(m=>[esc(InventoryTools.timestamp(m.created_at)),esc(outletName(m.outlet_id)),esc(m.item_name),esc(m.kind),esc(m.delta),esc(m.quantity),esc(m.unit),esc(m.cuisine),esc(m.vendor),esc(m.reason),esc(m.actor_name)]));
            pager(content.querySelector('.queue-pager'),previous.length,result.nextCursor,()=>{cursor=previous.pop();load();},()=>{previous.push(cursor);cursor=result.nextCursor;load();});
        }catch(error){if(token===generation)target.textContent=error.message;}}
        form.onsubmit=event=>{event.preventDefault();filterValues(form,filters);filters.allDates='1';delete filters.delivery;cursor=null;previous=[];content.querySelector('.queue-filter-panel').open=false;load();};
        form.querySelector('[data-history-today]').onclick=()=>{historyFilters={outlet:'',item:'',vendor:'',type:'',person:'',from:today(),to:today()};renderHistory(content);};refreshHistory=load;await load();
    }
    window.DeliveryQueues={render:renderDeliveries,refresh:()=>refreshDeliveries?.(),find:id=>rows.get(id),async accept(dispatchId,act){
        const deliveries=await allDispatchRows(dispatchId),remaining=deliveries.filter(d=>d.status==='Issued');
        if(!remaining.length){window.showToast('No items remain awaiting confirmation.','info');return;}
        if(!await window.showConfirmModal(`Accept the remaining ${remaining.length} item(s) in this delivery as received in full? Items already confirmed or reported with issues stay unchanged.`,'Accept remaining items'))return;
        return act('operations/deliveries/accept-all',{dispatchId,ids:remaining.map(d=>d.id)});
    }};
    window.StockHistoryQueues={render:renderHistory,refresh:()=>refreshHistory?.()};
})();
