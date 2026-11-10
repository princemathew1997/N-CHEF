(() => {
    const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money=value=>value==null?'Not set':(value/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
    const enabled=()=>committedState?.features?.stockPriceEditing===true;
    const permitted=()=>enabled() && ['admin','purchaser'].includes(currentUser?.role);
    let refresh,owner,filters,visible;
    function syncAvailability(){
        const show=permitted();
        document.querySelector('[data-inventory="stock-prices"]')?.classList.toggle('hidden',!show);
        if(visible!==show){visible=show;window.NavigationGroups?.configure();}
        if(!show && currentView==='inventory:stock-prices')window.goHome();
    }
    function render(content){
        if(!permitted())return;
        if(owner!==currentUser.id){owner=currentUser.id;filters={outlet:OutletSelection.restore(),category:'',search:''};}
        content.innerHTML=`<p>Set the unit price for outlet stock. Each change updates the remaining stock value and is recorded in Stock History.</p><div class="inventory-filters"><label>Outlet${OutletSelection.markup('priceOutlet',true)}</label><label>Category<select name="priceCategory"><option value="">All categories</option>${[...new Set(masterItemsData.map(i=>i.category))].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label>Item<input type="search" name="priceSearch" placeholder="Search stock items"></label></div><div data-stock-price-editor></div><p data-stock-price-status role="status"></p><div data-stock-price-list></div>`;
        const outlet=content.querySelector('[name=priceOutlet]'),category=content.querySelector('[name=priceCategory]'),search=content.querySelector('[name=priceSearch]');
        if(outlet.tagName==='SELECT')outlet.value=filters.outlet;
        category.value=filters.category;search.value=filters.search;
        const editor=content.querySelector('[data-stock-price-editor]');
        function draw(){
            if(!content.isConnected || !permitted())return;
            const outlets=OutletSelection.allowed(),selectedOutlets=outlets.filter(o=>!outlet.value || o.id===outlet.value);
            const stockMap=new Map((committedState.outletStock || []).map(b=>[`${b.item_id}:${b.outlet_id}`,b]));
            const rows=[];
            for(const o of selectedOutlets){
                for(const item of masterItemsData){
                    const existing=stockMap.get(`${item.id}:${o.id}`);
                    const qty=existing?.quantity || 0;
                    if(item.active===false && qty<=0)continue;
                    if(category.value && item.category!==category.value)continue;
                    if(search.value.trim() && !item.name.toLowerCase().includes(search.value.trim().toLowerCase()))continue;
                    rows.push({
                        item_id:item.id,
                        outlet_id:o.id,
                        quantity:qty,
                        unit_cost_minor:existing?.unit_cost_minor ?? null,
                        item,
                        outlet:o
                    });
                }
            }
            rows.sort((a,b)=>a.item.name.localeCompare(b.item.name) || a.outlet.name.localeCompare(b.outlet.name));
            content.querySelector('[data-stock-price-status]').textContent=`${rows.length} item(s) found`;
            content.querySelector('[data-stock-price-list]').innerHTML=`<div class="table-container"><table><thead><tr>${['Outlet','Item','Available','Unit','Current unit price','Stock value','Action'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((b,index)=>`<tr><td>${esc(b.outlet.name)}</td><td>${esc(b.item.name)}</td><td>${esc(b.quantity.toLocaleString('en-IN',{maximumFractionDigits:6}))}</td><td>${esc(b.item.unit)}</td><td>${money(b.unit_cost_minor)}</td><td>${money(b.unit_cost_minor==null?null:Math.round(b.quantity*b.unit_cost_minor))}</td><td><button type="button" class="btn btn-outline" data-current-price="${index}">Edit price</button></td></tr>`).join('') || '<tr><td colspan="7">No items match these filters.</td></tr>'}</tbody></table></div>`;
            content.querySelectorAll('[data-current-price]').forEach(button=>button.onclick=()=>edit(rows[Number(button.dataset.currentPrice)]));
        }
        function edit(balance){
            const snapshot={itemId:balance.item_id,outletId:balance.outlet_id,expectedQuantity:balance.quantity,expectedUnitCostMinor:balance.unit_cost_minor ?? null};
            editor.innerHTML=`<form class="inventory-form"><h2>Edit stock price</h2><p>${esc(balance.item.name)} · ${esc(balance.outlet.name)} · Available: ${esc(balance.quantity)} ${esc(balance.item.unit)}</p><label>Unit price (INR / ${esc(balance.item.unit)})<input name="unitPrice" type="number" min="0" max="1000000000" step="0.01" value="${balance.unit_cost_minor==null?'':(balance.unit_cost_minor/100).toFixed(2)}" required></label><label>Reason for price change<input name="reason" maxlength="500" required></label><p data-current-value role="status"></p><p data-current-price-error role="alert"></p><button type="submit" class="btn btn-primary">Save price</button><button type="button" class="btn btn-outline" data-current-cancel>Cancel</button></form>`;
            const form=editor.querySelector('form');let saving=false;
            const preview=()=>{const raw=form.elements.unitPrice.value,price=Number(raw),total=Math.round(balance.quantity*price*100);form.querySelector('[data-current-value]').textContent=raw!=='' && Number.isFinite(price) && price>=0 && Number.isSafeInteger(total)?'Updated stock value: '+money(total):'Enter a valid unit price.';};
            form.elements.unitPrice.oninput=preview;preview();
            form.querySelector('[data-current-cancel]').onclick=()=>{editor.innerHTML='';draw();};
            form.onsubmit=async event=>{
                event.preventDefault();if(saving || !form.reportValidity())return;
                saving=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
                try{
                    await runDatabaseAction('stock/current-price',{...snapshot,unitPrice:Number(form.elements.unitPrice.value),reason:form.elements.reason.value.trim()});
                    editor.innerHTML='';draw();window.renderOutletDashboard?.();window.showToast?.('Stock price updated','success');
                }catch(error){form.querySelector('[data-current-price-error]').textContent=error.message;}
                finally{saving=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
            };
            form.elements.unitPrice.focus();editor.scrollIntoView({block:'nearest',behavior:'smooth'});
        }
        const filter=()=>{filters={outlet:outlet.value,category:category.value,search:search.value};editor.innerHTML='';draw();};
        outlet.onchange=filter;category.onchange=filter;search.oninput=filter;
        refresh=()=>{if(!editor.querySelector('form'))draw();};draw();
    }
    window.CurrentStockPrices={enabled,render,refresh:()=>refresh?.(),syncAvailability};
})();
