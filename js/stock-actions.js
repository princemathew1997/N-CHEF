// Catalog metadata and outlet stock use separate server commands.
(() => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const titles = { overview:'Stock Overview', catalog:'Item Catalog', receipt:'Receive Stock', distribute:'Distribute to Cuisine', adjust:'Stock Adjustments', history:'Stock History', assign:'Add Legacy Stock', cuisines:'Cuisine Sections' };
    const adminPages = ['catalog','cuisines'];
    const allowedOutlets = () => OutletSelection.allowed();
    const options = (rows, value, label) => rows.map(r => `<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');
    const table = (headers, rows) => `<div class="table-container"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">No records yet.</td></tr>`}</tbody></table></div>`;
    const field = (label, control) => `<label>${label}${control}</label>`;
    const select = (name, contents) => `<select name="${name}" required>${contents}</select>`;
    let page = 'overview', editing = null, search = '', distributionOrder='';
    let panel;
    const error = e => window.showUiModal?.({title:'Change was not saved',message:e.message,type:'warning'});
    const activeItems = () => masterItemsData.filter(i => i.active !== false);
    const cost = (item,outlet) => committedState?.outletStock?.find(s=>s.item_id===item && s.outlet_id===outlet)?.unit_cost_minor;
    const price = minor => minor==null?'Cost unavailable':(minor/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
    const quantity = (item, outlet) => committedState?.outletStock?.find(s=>s.item_id===item && s.outlet_id===outlet)?.quantity || 0;
    const outletSelect = () => OutletSelection.markup();

    const reportFilters = {category:'',item:'',from:InventoryTools.day(),to:InventoryTools.day()};
    const overviewFilters = {outlet:'',category:'',item:''};
    const numberText = value => Number(value.toFixed(6)).toLocaleString('en-IN');
    const categories = () => [...new Set(masterItemsData.map(i=>i.category))].sort();
    const categoryOptions = () => '<option value="">All Categories</option>'+options(categories(),c=>c,c=>c);
    function overview(content) {
        content.innerHTML='<div class="inventory-filters">'+field('Outlet',OutletSelection.markup('overviewOutlet',true))+field('Category',select('category',categoryOptions()))+field('Item','<div id="overviewItemPicker"></div>')+'</div><div id="overviewRows"></div>';
        const category=content.querySelector('[name=category]');category.value=overviewFilters.category;
        const outlet=content.querySelector('[name=overviewOutlet]');
        if(outlet.tagName==='SELECT')outlet.value=overviewFilters.outlet;
        let picker;
        const draw=()=>{
            overviewFilters.outlet=outlet.value;overviewFilters.category=category.value;
            const rows=allowedOutlets().filter(o=>!outlet.value || o.id===outlet.value).flatMap(o=>masterItemsData.filter(i=>(i.active!==false || quantity(i.id,o.id)>0) && (!category.value || i.category===category.value) && (!overviewFilters.item || i.id===overviewFilters.item)).map(i=>[esc(o.name),esc(i.name),esc(i.category),numberText(quantity(i.id,o.id)),esc(i.unit),price(cost(i.id,o.id)),price(cost(i.id,o.id)==null?null:Math.round(quantity(i.id,o.id)*cost(i.id,o.id)))]));
            content.querySelector('#overviewRows').innerHTML=table(['Outlet','Item','Category','Available','Unit','Latest unit cost','Remaining value'],rows);
        };
        const mountPicker=()=>{const items=masterItemsData.filter(i=>!category.value || i.category===category.value);if(!items.some(i=>i.id===overviewFilters.item))overviewFilters.item='';picker=createItemPicker(content.querySelector('#overviewItemPicker'),items,{optional:true,selected:overviewFilters.item,onChange:id=>{overviewFilters.item=id;draw();}});};
        category.onchange=()=>{mountPicker();draw();};outlet.onchange=draw;mountPicker();draw();
    }
    window.renderOutletDashboard = () => {
        OutletSelection.restore();
        const tbody=document.getElementById('inventoryTableBody');if(!tbody)return;
        const filters=document.getElementById('masterStockFilters');
        if(!filters.dataset.bound){
            filters.innerHTML=field('Category',select('category',categoryOptions()))+field('Item','<div id="masterItemPicker"></div>')+field('From (IST)','<input type="date" name="from">')+field('To (IST)','<input type="date" name="to">')+'<p id="reportError" role="alert"></p>';
            filters.querySelector('[name=category]').onchange=e=>{reportFilters.category=e.target.value;reportFilters.item='';mountPicker();draw();};
            for(const name of ['from','to']){filters.querySelector('[name='+name+']').value=reportFilters[name];filters.querySelector('[name='+name+']').onchange=e=>{reportFilters[name]=e.target.value;draw();};}
            filters.dataset.bound='true';
        }
        const category=filters.querySelector('[name=category]');category.innerHTML=categoryOptions();category.value=reportFilters.category;
        function mountPicker(){const items=masterItemsData.filter(i=>!reportFilters.category || i.category===reportFilters.category);if(!items.some(i=>i.id===reportFilters.item))reportFilters.item='';createItemPicker(filters.querySelector('#masterItemPicker'),items,{optional:true,selected:reportFilters.item,onChange:id=>{reportFilters.item=id;draw();}});}
        function draw(){
            try {
                const items=masterItemsData.filter(i=>(!reportFilters.category || i.category===reportFilters.category) && (!reportFilters.item || i.id===reportFilters.item));
                const result=InventoryTools.report(items,committedState.outletStock,committedState.stockHistory,currentStoreView,reportFilters.from,reportFilters.to);
                const headings=['Item','Unit','Opening Stock','Received',...result.cuisines.map(c=>c+' Usage'),'Adjustments','Remaining Stock'];
                document.getElementById('inventoryTableHeader').innerHTML=headings.map(h=>'<th>'+esc(h)+'</th>').join('');
                tbody.innerHTML=result.rows.map(r=>'<tr>'+[esc(r.item.name),esc(r.item.unit),numberText(r.opening),numberText(r.received),...result.cuisines.map(c=>numberText(r.usage[c])),numberText(r.adjustments),numberText(r.remaining)].map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('') || `<tr><td colspan="${headings.length}">No stock activity matches these filters.</td></tr>`;
                const metrics={metricTotalItems:result.rows.length,metricActiveOutlets:result.rows.filter(r=>Object.values(r.usage).some(q=>q>0)).length,metricLowStock:result.rows.filter(r=>r.item.thresholdEnabled && r.remaining<=r.item.threshold).length};
                for(const [id,val] of Object.entries(metrics))document.getElementById(id).textContent=val;
                document.getElementById('metricTotalItemsLabel').textContent='Items in Report';document.getElementById('metricActiveOutletsLabel').textContent='Items Used';document.getElementById('metricLowStockLabel').textContent='Low Remaining Stock';
                filters.querySelector('#reportError').textContent='';
            } catch(e){filters.querySelector('#reportError').textContent=e.message;tbody.innerHTML='';}
        }
        mountPicker();draw();OutletSelection.renderHeader();
    };
    function orderDistribution(content){
        const orders=indentsData.filter(i=>i.status==='Approved' && allowedOutlets().some(o=>o.id===i.outletId) && InventoryTools.consolidatedDistributionRows(committedState,i.id).length);
        if(!orders.some(i=>i.id===distributionOrder))distributionOrder=orders[0]?.id || '';
        content.innerHTML=field('Approved consolidated order',`<select id="distributionOrder"><option value="">Choose an order</option>${options(orders,i=>i.id,i=>`${i.indentNumber} · ${outletsData.find(o=>o.id===i.outletId)?.name || i.outletId}`)}</select>`)+'<div id="orderDistributionLines"></div>';
        const picker=content.querySelector('#distributionOrder');picker.value=distributionOrder;
        picker.onchange=()=>{distributionOrder=picker.value;orderDistribution(content);};
        const target=content.querySelector('#orderDistributionLines');
        if(!distributionOrder){target.innerHTML='<p>No approved consolidated orders have outstanding cuisine quantities.</p>';return;}
        const rows=InventoryTools.consolidatedDistributionRows(committedState,distributionOrder),allocations=InventoryTools.defaultDistributionAllocations(rows);
        target.innerHTML=`<form id="orderDistributionForm"><p>Allocate stock against the remaining approved cuisine quantities. A comment is required whenever you issue a different quantity. Unissued quantities remain outstanding.</p>${table(['Item / unit','Cuisine','Approved remaining','Available stock','Issue now','Comment for change'],rows.map((r,index)=>{
            const item=masterItemsData.find(i=>i.id===r.itemId),allocated=allocations[index];
            return [esc(item?.name || r.itemName)+' ('+esc(item?.unit || r.unit)+')',esc(r.cuisine),esc(r.remaining),esc(r.available),`<input aria-label="Issue ${esc(item?.name || r.itemName)} to ${esc(r.cuisine)}" name="quantity_${index}" type="number" min="0" max="${r.remaining}" step="any" value="${allocated}" required>`,`<input aria-label="Comment ${esc(item?.name || r.itemName)} ${esc(r.cuisine)}" name="comment_${index}" maxlength="500" placeholder="Required if quantity changes">`];
        }))}<p id="distributionAvailabilityMessage" role="status"></p><button class="btn btn-primary">Distribute order</button></form>`;
        const form=target.querySelector('form');
        const validate=()=>{
            const totals=new Map();rows.forEach((r,index)=>totals.set(r.itemId,(totals.get(r.itemId) || 0)+Number(form.elements['quantity_'+index].value || 0)));
            rows.forEach((r,index)=>{
                const quantity=form.elements['quantity_'+index],note=form.elements['comment_'+index],changed=Math.abs(Number(quantity.value)-r.remaining)>1e-8;
                note.required=changed;note.setCustomValidity(changed && !note.value.trim()?'Explain the changed issue quantity.':'');
                quantity.setCustomValidity(totals.get(r.itemId)>r.available+1e-8?'Total allocation exceeds available outlet stock.':'');
            });
        };
        form.oninput=validate;form.onchange=validate;validate();
        form.onsubmit=e=>{e.preventDefault();validate();if(!form.reportValidity())return;submit(form,()=>runDatabaseAction('operations/distribution/issue',{indentId:distributionOrder,lines:rows.map((r,index)=>({requestId:r.id,quantity:Number(form.elements['quantity_'+index].value),comment:form.elements['comment_'+index].value.trim()}))}));};
    }
    function render() {
        if (!panel || !currentUser) return;
        if(currentUser.role==='executive_chef' && !['overview','history'].includes(page)){window.switchToView('operations:dashboard');return;}
        if (adminPages.includes(page) && currentUser.role !== 'admin') { window.switchToView('viewMasterOrders'); return; }
        panel.innerHTML = `<header class="dash-header"><div><h1>${titles[page]}</h1><p>${page==='catalog'?'Manage item details here. Receive quantities through Stock.':'Stock is held by outlet. Cuisine distributions deduct stock immediately.'}</p></div></header><div class="panel inventory-workspace" id="inventoryContent"></div>`;
        const content=panel.querySelector('#inventoryContent');
        if(page==='overview') overview(content);
        if(page==='distribute'){orderDistribution(content);return;}
        if(page==='catalog') {
            const item=editing ? masterItemsData.find(i=>i.id===editing) : null;
            const locked=item && (committedState.stockHistory.some(m=>m.item_id===item.id) || item.bought>0);
            content.innerHTML=`<form id="catalogForm" class="inventory-form">
                <h3>${item?'Edit Item':'Add Catalog Item'}</h3>
                ${field('Item name',`<input name="name" required maxlength="200" value="${esc(item?.name)}">`)}
                ${field('Category',select('category',options((committedState.operationRecords || []).filter(r=>r.kind==='category'),r=>r.name,r=>r.name)))}
                ${field('Unit',select('unit',options((committedState.operationRecords || []).filter(r=>r.kind==='unit' && (!locked || r.name===item.unit)),r=>r.name,r=>r.name)))}
                <div class="threshold-setting"><label class="threshold-toggle"><span>Low-stock alerts for this item</span><span class="threshold-switch"><input type="checkbox" role="switch" name="thresholdEnabled" ${item?.thresholdEnabled===true?'checked':''}><span class="threshold-track" aria-hidden="true"></span></span><span id="thresholdToggleStatus">${item?.thresholdEnabled===true?'On':'Off'}</span></label></div>
                ${field('Threshold per outlet',`<input type="number" min="0" step="any" name="threshold" value="${esc(item?.threshold || 0)}" required>`)}
                <p><a href="#" onclick="switchToView('operations:category');return false">Manage categories</a> · <a href="#" onclick="switchToView('operations:unit');return false">Manage units</a></p>
                ${field('Preferred vendor',select('vendor', options(vendorsData,v=>v.name,v=>v.name)))}
                ${field('Cuisine label',select('cuisine',options(cuisinesData,c=>c.name,c=>c.name)))}
                ${field('Status','<select name="active"><option value="true">Active</option><option value="false">Inactive</option></select>')}
                <div><button class="btn btn-primary">${item?'Save Changes':'Add to Catalog'}</button> <button class="btn btn-outline" type="button" id="catalogReset">Clear</button></div>
                </form><label class="inventory-search">Search catalog<input id="catalogSearch" placeholder="Search name or category" value="${esc(search)}"></label><div id="catalogRows"></div>`;
            const form=content.querySelector('form');
            form.elements.thresholdEnabled.onchange=()=>{content.querySelector('#thresholdToggleStatus').textContent=form.elements.thresholdEnabled.checked?'On':'Off';};
            if(item){form.elements.category.value=item.category;form.elements.unit.value=item.unit;form.elements.vendor.value=item.vendor;form.elements.cuisine.value=item.cuisine || cuisinesData[0]?.name;form.elements.active.value=String(item.active!==false);}
            const renderRows=()=>{
                const matches=masterItemsData.filter(i=>(i.name+' '+i.category).toLowerCase().includes(search.toLowerCase()));
                content.querySelector('#catalogRows').innerHTML=table(['Item','Category','Unit','Vendor','Cuisine','Low-stock alerts','Status','Action'],matches.map(i=>[esc(i.name)+(masterItemsData.some(other=>other.id!==i.id && other.name.trim().toLowerCase()===i.name.trim().toLowerCase())?' <small>Duplicate name — review</small>':''),esc(i.category),esc(i.unit),esc(i.vendor),esc(i.cuisine),i.thresholdEnabled===true?'On · '+esc(i.threshold ?? 0)+' '+esc(i.unit)+' per outlet':'Off',i.active===false?'Inactive':'Active',`<button class="btn btn-outline" data-edit="${esc(i.id)}">Edit</button>`]));
                content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editing=b.dataset.edit;render();});
            };renderRows();
            content.querySelector('#catalogSearch').oninput=e=>{search=e.target.value;renderRows();};
            content.querySelector('#catalogReset').onclick=()=>{editing=null;render();};
            form.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));const original=item || {id:crypto.randomUUID(),bought:0,allocations:{},consumed:{}};const value={...original,...data,active:data.active==='true',thresholdEnabled:form.elements.thresholdEnabled.checked,threshold:Number(data.threshold)};
                await submit(form,async()=>{if(item && JSON.stringify(item)!==JSON.stringify(masterItemsData.find(i=>i.id===item.id)))throw new Error('Item changed. Reopen it before saving.');await runDatabaseAction('changes',{changes:[{entity:'items',key:value.id,value}]});editing=null;});};
        }
        if(['receipt','distribute','adjust','assign'].includes(page)) {
            const items=page==='adjust'?masterItemsData:activeItems();
            content.innerHTML=`${page==='receipt' && ['admin','purchaser'].includes(currentUser.role)?'<div style="margin-bottom:16px;"><button type="button" class="btn btn-outline" data-receive-po>Receive stock from Vendor Order</button></div>':''}<form id="outletStockForm" class="inventory-form">
            ${field('Outlet',outletSelect())}${field('Item','<div id="stockItemPicker"></div>')}
            <p id="availableStock"></p>
            ${page==='receipt'?field('Vendor',select('vendor',options(vendorsData,v=>v.name,v=>v.name)))+field('<span id="receiptPriceLabel">Unit price (INR)</span>','<input name="unitPrice" type="number" min="0" step="0.01" required>')+'<p id="receiptTotal">Total: ₹0.00</p>':''}
            ${page==='assign'?'<p>Vendor: <strong>Legacy Stock</strong>. Quantity is added directly to this outlet’s available stock.</p>'+field('Unit price (optional, INR)','<input name="unitPrice" type="number" min="0" step="0.01">'):''}
            ${page==='distribute'?field('Cuisine',select('cuisine',options(cuisinesData,c=>c.name,c=>c.name)))+'<input type="hidden" name="requestId"><label id="requestChoiceLabel" class="hidden">Approved cuisine request<select name="requestChoice"></select></label><p id="distributionRequestHint"></p><a href="#" data-operations="deliveries">View cuisine deliveries and receipt issues</a>':''}
            ${field(page==='adjust'?'Actual on-hand quantity':'Quantity',`<span class="quantity-entry"><input name="quantity" type="number" step="any" min="${page==='adjust'?'0':'0.00000001'}" required><span class="stock-unit" aria-label="Unit"></span></span>`)}
            ${field(page==='adjust'?'Reason (required)':'Note',`<input name="reason" maxlength="500" ${page==='adjust'?'required':''}>`)}
            <button class="btn btn-primary">${titles[page]}</button></form><div id="legacyDetails"></div>`;
            const form=content.querySelector('form');
            const update=()=>{
                const item=masterItemsData.find(i=>i.id===form.elements.itemId.value),unit=item?.unit || '';
                content.querySelector('.stock-unit').textContent=unit || 'Unit';
                content.querySelector('#availableStock').textContent=item?`Available: ${quantity(item.id,form.elements.outletId.value)} ${unit}`:'Select an item to see available stock.';
                if(page==='receipt'){
                    content.querySelector('#receiptPriceLabel').textContent=unit?`Unit price (INR / ${unit})`:'Unit price (INR)';
                    content.querySelector('#receiptTotal').textContent='Total: '+price(Math.round(Number(form.elements.quantity.value || 0)*Math.round(Number(form.elements.unitPrice.value || 0)*100)));
                }
                if(page==='distribute'){
                    const matches=InventoryTools.distributionRequests(requestsData,committedState.operationRecords || [],form.elements.itemId.value,form.elements.outletId.value,form.elements.cuisine.value);
                    const open=matches.filter(r=>r.remainingQuantity>0),choice=form.elements.requestChoice,selected=choice.value;
                    const multiple=open.length>1;
                    content.querySelector('#requestChoiceLabel').classList.toggle('hidden',!multiple);choice.required=multiple;
                    choice.innerHTML='<option value="">Choose a cuisine request</option>'+options(open,r=>r.id,r=>`${r.requestedBy || r.chefName || r.id}: ${r.remainingQuantity} ${unit} remaining`);
                    choice.value=open.some(r=>r.id===selected)?selected:'';
                    form.elements.requestId.value=open.length===1?open[0].id:multiple?choice.value:'';
                    const linked=open.find(r=>r.id===form.elements.requestId.value);
                    content.querySelector('#distributionRequestHint').textContent=!item?'Select an item and cuisine.':linked?`For ${linked.requestedBy || linked.chefName || form.elements.cuisine.value}: ${linked.remainingQuantity} ${unit} remaining to issue. This delivery will appear for receipt confirmation.`:multiple?'Choose which approved cuisine request this delivery fulfils.':matches.length?'Approved requests for this item and cuisine have already been fully issued.':'Direct issue to this cuisine; no approved request is waiting for this item.';
                    form.elements.quantity.setCustomValidity(matches.length && !open.length?'Approved requests have already been fully issued.':'');
                }
            };
            form.oninput=update;form.onchange=()=>{OutletSelection.choose(form.elements.outletId.value);update();};createItemPicker(content.querySelector('#stockItemPicker'),items,{onChange:update});update();
            form.onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));delete data.requestChoice;data.quantity=Number(data.quantity);if(data.unitPrice!==undefined)data.unitPrice=Number(data.unitPrice);if(page==='assign' && form.elements.unitPrice.value==='')delete data.unitPrice;submit(form,()=>runDatabaseAction('stock/'+(page==='assign'?'opening':page),data));};
        }
        if(page==='history') {
            content.innerHTML=field('Filter by outlet',OutletSelection.markup('historyOutlet',currentUser.role==='admin'))+ '<div id="historyRows"></div>';
            const update=()=>{const outlet=content.querySelector('[name=historyOutlet]').value;content.querySelector('#historyRows').innerHTML=table(['Date','Outlet','Item','Action','Change','Balance','Unit','Cuisine','Vendor','Reason','Person'],committedState.stockHistory.filter(m=>!outlet || m.outlet_id===outlet).map(m=>[esc(InventoryTools.timestamp(m.created_at)),esc(outletsData.find(o=>o.id===m.outlet_id)?.name),esc(m.item_name),esc(m.kind),esc(m.delta),esc(m.quantity),esc(m.unit),esc(m.cuisine),esc(m.vendor),esc(m.reason),esc(m.actor_name)]));};content.querySelector('[name=historyOutlet]').onchange=update;update();
        }
        if(page==='cuisines') {
            content.innerHTML=`<form class="inventory-form"><h3>Add Cuisine Section</h3>${field('Name','<input name="name" required maxlength="200">')}<button class="btn btn-primary">Add Section</button></form>`+table(['Cuisine section'],cuisinesData.map(c=>[esc(c.name)]));
            const form=content.querySelector('form');form.onsubmit=e=>{e.preventDefault();submit(form,()=>runDatabaseAction('cuisines/add',{name:form.elements.name.value}));};
        }
    }
    async function submit(form, action) {
        const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
        try {await action();render();window.renderOutletDashboard();window.showToast?.('Saved successfully','success');}
        catch(e){try{applyServerState(await apiRequest('state'));}catch{} error(e);}
        finally{buttons.forEach(b=>b.disabled=false);}
    }
    window.showInventoryView = view => {
        if(!view.startsWith('inventory:')) return false;
        if(!currentUser || currentUser.role==='cuisine_head') {window.switchToView('viewChefPortal');return true;}
        page=view.slice(10);if(!titles[page])page='overview';
        if(page==='distribute' && !['admin','purchaser'].includes(currentUser.role)){window.goHome();return true;}
        if(adminPages.includes(page) && currentUser.role!=='admin'){window.switchToView('viewMasterOrders');return true;}
        panel?.classList.remove('hidden');render();
        const stockLink = document.querySelector(`#navStockSubmenu [data-inventory="${page}"]`);
        if(page==='catalog')window.expandSidebarGroup('Catalog');
        if(page==='distribute'){window.expandSidebarGroup('Distribution');document.getElementById('navDistribution')?.classList.add('active');}
        if(page==='assign'){window.expandSidebarGroup('Legacy');document.getElementById('navLegacy')?.classList.add('active');}
        if(['overview','receipt','adjust','history'].includes(page)){window.expandSidebarGroup('Overview');document.getElementById('navStock')?.classList.add('active');}
        if(stockLink && !['distribute','assign','overview','receipt','adjust','history'].includes(page)) {
            window.expandSidebarGroup('Stock');
            document.getElementById('navStockSubmenu')?.classList.add('open');
            document.getElementById('navStock')?.classList.add('active');
            const chevron = document.getElementById('navStockChevron');
            if(chevron) chevron.style.transform='rotate(180deg)';
        }
        document.querySelectorAll('[data-inventory]').forEach(a=>a.classList.toggle('active',a.dataset.inventory===page));
        document.getElementById('mobileActivePage').textContent=titles[page];
        return true;
    };
    document.addEventListener('DOMContentLoaded',()=>{
        panel=document.createElement('div');panel.id='viewInventory';panel.className='hidden';document.getElementById('viewMasterOrders').parentElement.append(panel);
        document.querySelectorAll('[data-inventory]').forEach(a=>a.onclick=e=>{
            e.preventDefault();
            const group=a.id==='navOverview'?'Overview':a.id==='navCatalog'?'Catalog':null;
            const wasOpen=group && document.getElementById('nav'+group+'Submenu').classList.contains('open');
            window.switchToView('inventory:'+a.dataset.inventory);
            if(wasOpen){
                document.getElementById('nav'+group+'Submenu').classList.remove('open');
                a.setAttribute('aria-expanded','false');
                document.getElementById('nav'+group+'Chevron').style.transform='rotate(0deg)';
            }
        });
        document.addEventListener('click',async e=>{
            const button=e.target.closest('[data-receive-po]');if(!button)return;
            e.preventDefault();
            button.disabled=true;try {window.openVendorOrderReceiving();}catch(e){error(e);}finally{button.disabled=false;}
        });
        const oldSync=window.onLiveSyncReceived;window.onLiveSyncReceived=()=>{oldSync?.();if(currentView.startsWith('inventory:') && !panel.querySelector('form') && !panel.contains(document.activeElement))render();};
        window.openAddItemModal=()=>{editing=null;window.switchToView('inventory:catalog');};
    });
})();
