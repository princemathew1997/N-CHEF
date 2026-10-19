// Catalog metadata and outlet stock use separate server commands.
(() => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const titles = { overview:'Stock Overview', catalog:'Item Catalog', receipt:'Receive Stock', distribute:'Distribute to Cuisine', adjust:'Stock Adjustments', history:'Stock History', assign:'Assign Legacy Stock', cuisines:'Cuisine Sections' };
    const adminPages = ['overview','catalog','assign','cuisines'];
    const allowedOutlets = () => OutletSelection.allowed();
    const options = (rows, value, label) => rows.map(r => `<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');
    const table = (headers, rows) => `<div class="table-container"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">No records yet.</td></tr>`}</tbody></table></div>`;
    const field = (label, control) => `<label>${label}${control}</label>`;
    const select = (name, contents) => `<select name="${name}" required>${contents}</select>`;
    let page = 'overview', editing = null, search = '';
    let panel;
    const error = e => window.showUiModal?.({title:'Change was not saved',message:e.message,type:'warning'});
    const activeItems = () => masterItemsData.filter(i => i.active !== false);
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
            const rows=allowedOutlets().filter(o=>!outlet.value || o.id===outlet.value).flatMap(o=>masterItemsData.filter(i=>(i.active!==false || quantity(i.id,o.id)>0) && (!category.value || i.category===category.value) && (!overviewFilters.item || i.id===overviewFilters.item)).map(i=>[esc(o.name),esc(i.name),esc(i.category),numberText(quantity(i.id,o.id)),esc(i.unit)]));
            content.querySelector('#overviewRows').innerHTML=table(['Outlet','Item','Category','Available','Unit'],rows);
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
                const metrics={metricTotalItems:result.rows.length,metricActiveOutlets:result.rows.filter(r=>Object.values(r.usage).some(q=>q>0)).length,metricLowStock:result.rows.filter(r=>r.remaining<=5).length};
                for(const [id,val] of Object.entries(metrics))document.getElementById(id).textContent=val;
                document.getElementById('metricTotalItemsLabel').textContent='Items in Report';document.getElementById('metricActiveOutletsLabel').textContent='Items Used';document.getElementById('metricLowStockLabel').textContent='Low Remaining Stock';
                filters.querySelector('#reportError').textContent='';
            } catch(e){filters.querySelector('#reportError').textContent=e.message;tbody.innerHTML='';}
        }
        mountPicker();draw();OutletSelection.renderHeader();
    };
    function render() {
        if (!panel || !currentUser) return;
        if (adminPages.includes(page) && currentUser.role !== 'admin') { window.switchToView('viewMasterOrders'); return; }
        panel.innerHTML = `<header class="dash-header"><div><h1>${titles[page]}</h1><p>${page==='catalog'?'Manage item details here. Receive quantities through Stock.':'Stock is held by outlet. Cuisine distributions deduct stock immediately.'}</p></div></header><div class="panel inventory-workspace" id="inventoryContent"></div>`;
        const content=panel.querySelector('#inventoryContent');
        if(page==='overview') overview(content);
        if(page==='catalog') {
            const item=editing ? masterItemsData.find(i=>i.id===editing) : null;
            const locked=item && (committedState.stockHistory.some(m=>m.item_id===item.id) || item.bought>0);
            content.innerHTML=`<form id="catalogForm" class="inventory-form">
                <h3>${item?'Edit Item':'Add Catalog Item'}</h3>
                ${field('Item name',`<input name="name" required maxlength="200" value="${esc(item?.name)}">`)}
                ${field('Category',`<input name="category" required maxlength="200" value="${esc(item?.category || 'Grocery')}">`)}
                ${field('Unit',`<input name="unit" required maxlength="200" value="${esc(item?.unit || 'kg')}" ${locked?'readonly':''}>${locked?'<small>Unit is locked because stock history exists.</small>':''}`)}
                ${field('Preferred vendor',select('vendor', options(vendorsData,v=>v.name,v=>v.name)))}
                ${field('Cuisine label',select('cuisine',options(cuisinesData,c=>c.name,c=>c.name)))}
                ${field('Status','<select name="active"><option value="true">Active</option><option value="false">Inactive</option></select>')}
                <div><button class="btn btn-primary">${item?'Save Changes':'Add to Catalog'}</button> <button class="btn btn-outline" type="button" id="catalogReset">Clear</button></div>
                </form><label class="inventory-search">Search catalog<input id="catalogSearch" placeholder="Search name or category" value="${esc(search)}"></label><div id="catalogRows"></div>`;
            const form=content.querySelector('form');
            if(item){form.elements.vendor.value=item.vendor;form.elements.cuisine.value=item.cuisine || cuisinesData[0]?.name;form.elements.active.value=String(item.active!==false);}
            const renderRows=()=>{
                const matches=masterItemsData.filter(i=>(i.name+' '+i.category).toLowerCase().includes(search.toLowerCase()));
                content.querySelector('#catalogRows').innerHTML=table(['Item','Category','Unit','Vendor','Cuisine','Status','Action'],matches.map(i=>[esc(i.name)+(masterItemsData.some(other=>other.id!==i.id && other.name.trim().toLowerCase()===i.name.trim().toLowerCase())?' <small>Duplicate name — review</small>':''),esc(i.category),esc(i.unit),esc(i.vendor),esc(i.cuisine),i.active===false?'Inactive':'Active',`<button class="btn btn-outline" data-edit="${esc(i.id)}">Edit</button>`]));
                content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editing=b.dataset.edit;render();});
            };renderRows();
            content.querySelector('#catalogSearch').oninput=e=>{search=e.target.value;renderRows();};
            content.querySelector('#catalogReset').onclick=()=>{editing=null;render();};
            form.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));const original=item || {id:crypto.randomUUID(),bought:0,allocations:{},consumed:{}};const value={...original,...data,active:data.active==='true'};
                await submit(form,async()=>{await runDatabaseAction('changes',{changes:[{entity:'items',key:value.id,value}]});editing=null;});};
        }
        if(['receipt','distribute','adjust','assign'].includes(page)) {
            const items=['adjust','assign'].includes(page)?masterItemsData:activeItems();
            content.innerHTML=`<form id="outletStockForm" class="inventory-form">
            ${field('Outlet',outletSelect())}${field('Item','<div id="stockItemPicker"></div>')}
            <p id="availableStock"></p>
            ${page==='receipt'?field('Vendor',select('vendor',options(vendorsData,v=>v.name,v=>v.name))):''}
            ${page==='distribute'?field('Cuisine',select('cuisine',options(cuisinesData,c=>c.name,c=>c.name))):''}
            ${field(page==='adjust'?'Actual on-hand quantity':'Quantity',`<input name="quantity" type="number" step="any" min="${page==='adjust'?'0':'0.00000001'}" required>`)}
            ${field(page==='adjust'?'Reason (required)':'Note',`<input name="reason" maxlength="500" ${page==='adjust'?'required':''}>`)}
            <button class="btn btn-primary">${titles[page]}</button></form><div id="legacyDetails"></div>`;
            const form=content.querySelector('form');
            const update=()=>{content.querySelector('#availableStock').textContent=form.elements.itemId.value ? `Available: ${quantity(form.elements.itemId.value,form.elements.outletId.value)}` : 'Select an item to see available stock.';};form.onchange=()=>{OutletSelection.choose(form.elements.outletId.value);update();};createItemPicker(content.querySelector('#stockItemPicker'),items,{onChange:update});update();
            form.onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));data.quantity=Number(data.quantity);submit(form,()=>runDatabaseAction('stock/'+page,data));};
            if(page==='assign')content.querySelector('#legacyDetails').innerHTML=table(['Item','Unassigned quantity','Reconciliation'],(committedState.legacyStock || []).filter(s=>s.quantity!==0 || s.issue).map(s=>[esc(masterItemsData.find(i=>i.id===s.item_id)?.name),esc(s.quantity),esc(s.issue || 'Ready to assign')]));
        }
        if(page==='assign') {
            const issues=(committedState.legacyStock || []).filter(s=>s.issue);
            if(issues.length) {
                const original = document.createElement('div');
                original.innerHTML=table(['Item','Original bought','Original outlet allocations','Original consumed'],issues.map(s=>{const i=masterItemsData.find(i=>i.id===s.item_id);return [esc(i?.name),esc(i?.bought),esc(JSON.stringify(i?.allocations)),esc(JSON.stringify(i?.consumed))];}));content.append(original);
                const form=document.createElement('form');form.className='inventory-form';
                form.innerHTML='<h3>Reconcile Legacy Stock</h3><p>Review the original quantities and verify outlet counts through Stock Adjustments. Enter the verified remaining unassigned quantity below.</p>'+field('Item','<div class="reconcile-picker"></div>')+field('Verified unassigned quantity','<input name="quantity" type="number" min="0" step="any" required>')+field('Reconciliation reason','<input name="reason" required maxlength="500">')+'<button class="btn btn-primary">Save Reconciliation</button>';
                form.onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));data.quantity=Number(data.quantity);submit(form,()=>runDatabaseAction('stock/reconcile',data));};content.append(form);createItemPicker(form.querySelector('.reconcile-picker'),masterItemsData.filter(i=>issues.some(s=>s.item_id===i.id)));
            }
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
        if(!currentUser || currentUser.role==='chef') {window.switchToView('viewChefPortal');return true;}
        page=view.slice(10);if(!titles[page])page='overview';
        if(adminPages.includes(page) && currentUser.role!=='admin'){window.switchToView('viewMasterOrders');return true;}
        panel?.classList.remove('hidden');render();
        const stockLink = document.querySelector(`#navStockSubmenu [data-inventory="${page}"]`);
        if(stockLink) {
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
        document.querySelectorAll('[data-inventory]').forEach(a=>a.onclick=e=>{e.preventDefault();window.switchToView('inventory:'+a.dataset.inventory);});
        document.addEventListener('click',async e=>{
            const button=e.target.closest('[data-receive-po]');if(!button)return;
            button.disabled=true;try {await runDatabaseAction('purchase-orders/receive',{poId:button.dataset.receivePo});window.renderVendorPOTable?.();}catch(e){error(e);}finally{button.disabled=false;}
        });
        const oldSync=window.onLiveSyncReceived;window.onLiveSyncReceived=()=>{oldSync?.();if(currentView.startsWith('inventory:') && !panel.contains(document.activeElement))render();};
        window.openAddItemModal=()=>{editing=null;window.switchToView('inventory:catalog');};
    });
})();
