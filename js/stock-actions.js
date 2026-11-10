// Catalog metadata and outlet stock use separate server commands.
(() => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const titles = { overview:'Stock Overview', 'bulk-receipt':'Receive Bulk Stock', catalog:'Item Catalog', receipt:'Receive Stock', distribute:'Distribute to Cuisine', adjust:'Stock Adjustments', history:'Stock History', assign:'Add Legacy Stock', cuisines:'Cuisine Sections' };
    titles.prices='Price History';
    titles['stock-prices']='Edit Stock Prices';
    const adminPages = ['cuisines'];
    let bulkReceiptMode = false;
    let bulkReceiptItems = [];
    let bulkCuisineMode = false;
    const canOpenCatalog = () => ['admin','purchaser'].includes(currentUser?.role);
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
    let reportSequence=0;
    const overviewFilters = {outlet:'',category:'',item:''};
    const numberText = value => Number(value.toFixed(6)).toLocaleString('en-IN');
    const categories = () => [...new Set(masterItemsData.map(i=>i.category))].sort();
    const categoryOptions = () => '<option value="">All Categories</option>'+options(categories(),c=>c,c=>c);
    function overview(content) {
        const canQuickEdit = ['admin','purchaser'].includes(currentUser?.role);
        content.innerHTML=`<div class="inventory-filters">${field('Outlet',OutletSelection.markup('overviewOutlet',true))}${field('Category',select('category',categoryOptions()))}${field('Item','<div id="overviewItemPicker"></div>')}</div><div id="overviewQuickEditor"></div><div id="overviewRows"></div>`;
        const category=content.querySelector('[name=category]');category.value=overviewFilters.category;
        const outlet=content.querySelector('[name=overviewOutlet]');
        if(outlet.tagName==='SELECT')outlet.value=overviewFilters.outlet;
        let picker;
        const quickEditor = content.querySelector('#overviewQuickEditor');
        const draw=()=>{
            overviewFilters.outlet=outlet.value;overviewFilters.category=category.value;
            const outletList = allowedOutlets().filter(o=>!outlet.value || o.id===outlet.value);
            const filteredItems = [];
            for (const o of outletList) {
                for (const i of masterItemsData) {
                    if ((i.active!==false || quantity(i.id,o.id)>0) && (!category.value || i.category===category.value) && (!overviewFilters.item || i.id===overviewFilters.item)) {
                        filteredItems.push({ outlet: o, item: i, qty: quantity(i.id, o.id), unitCost: cost(i.id, o.id) });
                    }
                }
            }
            const headers = ['Outlet','Item','Category','Available','Unit','Current unit cost','Remaining value', ...(canQuickEdit ? ['Action'] : [])];
            const rows = filteredItems.map((row, idx) => [
                esc(row.outlet.name),
                esc(row.item.name),
                esc(row.item.category),
                numberText(row.qty),
                esc(row.item.unit),
                price(row.unitCost),
                price(row.unitCost == null ? null : Math.round(row.qty * row.unitCost)),
                ...(canQuickEdit ? [`<button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.82rem;" data-quick-edit="${idx}">Edit</button>`] : [])
            ]);
            content.querySelector('#overviewRows').innerHTML=table(headers, rows);
            if (canQuickEdit) {
                content.querySelectorAll('[data-quick-edit]').forEach(btn => {
                    btn.onclick = () => openQuickEdit(filteredItems[Number(btn.dataset.quickEdit)]);
                });
            }
        };

        function openQuickEdit(target) {
            const currentUnitCostVal = target.unitCost != null ? (target.unitCost / 100).toFixed(2) : '';
            const unitOptions = (committedState.operationRecords || []).filter(r => r.kind === 'unit').map(r => r.name);
            if (!unitOptions.includes(target.item.unit)) unitOptions.unshift(target.item.unit);

            quickEditor.innerHTML = `
                <form class="inventory-form" style="margin-bottom: 20px; border: 1.5px solid var(--primary, #FFBE0B); background: #18191c; padding: 18px; border-radius: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0; color: var(--primary, #FFBE0B); font-size: 1.1rem;">Quick Edit Stock: ${esc(target.item.name)} (${esc(target.outlet.name)})</h3>
                        <button type="button" class="btn btn-outline" data-quick-cancel style="padding: 2px 8px; font-size: 0.8rem;">✕ Close</button>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                        <label>Available Quantity
                            <input name="quickQty" type="number" step="any" min="0" value="${esc(target.qty)}" required>
                        </label>
                        <label>Unit
                            <select name="quickUnit">
                                ${unitOptions.map(u => `<option value="${esc(u)}" ${u === target.item.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}
                            </select>
                        </label>
                        <label>Current Unit Cost (INR)
                            <input name="quickCost" type="number" step="0.01" min="0" max="1000000000" placeholder="e.g. 25.00" value="${esc(currentUnitCostVal)}">
                        </label>
                    </div>
                    <label style="margin-top: 10px; display: block;">Reason / Note (required for audit)
                        <input name="quickReason" maxlength="500" placeholder="e.g. Physical count update & baseline price verification" required>
                    </label>
                    <p data-quick-error role="alert" style="color: #ff6b6b; margin: 8px 0 0 0; font-size: 0.88rem;"></p>
                    <div style="margin-top: 14px; display: flex; gap: 10px;">
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                        <button type="button" class="btn btn-outline" data-quick-cancel>Cancel</button>
                    </div>
                </form>
            `;

            const form = quickEditor.querySelector('form');
            form.querySelectorAll('[data-quick-cancel]').forEach(b => b.onclick = () => { quickEditor.innerHTML = ''; });

            form.onsubmit = async (e) => {
                e.preventDefault();
                if (!form.reportValidity()) return;
                const errP = form.querySelector('[data-quick-error]');
                errP.textContent = '';
                const buttons = form.querySelectorAll('button');
                buttons.forEach(b => b.disabled = true);

                try {
                    const newQty = Number(form.elements.quickQty.value);
                    const newUnit = form.elements.quickUnit?.value?.trim();
                    const rawCost = form.elements.quickCost.value.trim();
                    const newCost = rawCost !== '' ? Number(rawCost) : null;
                    const reason = form.elements.quickReason.value.trim();

                    // 1. If Available quantity changed, execute stock/adjust
                    if (newQty !== target.qty) {
                        await runDatabaseAction('stock/adjust', {
                            itemId: target.item.id,
                            outletId: target.outlet.id,
                            quantity: newQty,
                            reason: reason
                        });
                    }

                    // 2. If Current unit cost changed or was provided
                    if (newCost !== null) {
                        const targetMinor = Math.round(newCost * 100);
                        if (targetMinor !== (target.unitCost ?? null)) {
                            // Find the latest snapshot quantity (if we adjusted, it's newQty, else target.qty)
                            const currentQty = newQty !== target.qty ? newQty : target.qty;
                            await runDatabaseAction('stock/current-price', {
                                itemId: target.item.id,
                                outletId: target.outlet.id,
                                expectedQuantity: currentQty,
                                expectedUnitCostMinor: target.unitCost ?? null,
                                unitPrice: newCost,
                                reason: reason
                            });
                        }
                    }

                    // 3. If Unit changed (Admin or Supervisor)
                    if (newUnit && newUnit !== target.item.unit) {
                        const original = masterItemsData.find(i => i.id === target.item.id) || target.item;
                        const value = { ...original, unit: newUnit };
                        await runDatabaseAction('changes', {
                            changes: [{ entity: 'items', key: value.id, value }]
                        });
                    }

                    quickEditor.innerHTML = '';
                    draw();
                    window.renderOutletDashboard?.();
                    window.showToast?.('Stock values updated successfully', 'success');
                } catch (err) {
                    errP.textContent = err.message;
                } finally {
                    buttons.forEach(b => b.disabled = false);
                }
            };

            quickEditor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

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
        async function draw(){
            const sequence=++reportSequence;
            try {
                const items=masterItemsData.filter(i=>(!reportFilters.category || i.category===reportFilters.category) && (!reportFilters.item || i.id===reportFilters.item));
                const result=committedState.historyPaged?await apiRequest('stock/report?'+new URLSearchParams({outlet:currentStoreView,from:reportFilters.from,to:reportFilters.to,item:reportFilters.item,category:reportFilters.category})):InventoryTools.report(items,committedState.outletStock,committedState.stockHistory,currentStoreView,reportFilters.from,reportFilters.to);
                if(sequence!==reportSequence || !tbody.isConnected)return;
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
        if (bulkCuisineMode) {
            const myRequests = indentsData.filter(i => allowedOutlets().some(o => o.id === i.outletId));
            const historyTable = myRequests.length ? `
                <div style="margin-top: 24px; text-align: left;">
                    <h4 style="margin: 0 0 12px 0; color: #fff; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="history" style="width: 16px; height: 16px; color: var(--primary);"></i> Bulk Cuisine Request History & Status
                    </h4>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr><th>Order Number</th><th>Outlet</th><th>Date</th><th>Items</th><th>Status</th><th>Notes / Reason</th></tr>
                            </thead>
                            <tbody>
                                ${myRequests.map(req => {
                                    const totalItems = (req.items || []).length;
                                    let badge = `<span class="status low">${esc(req.status)}</span>`;
                                    if (req.status === 'Pending Approval') {
                                        badge = `<span class="status pending" style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); font-weight: 600; padding: 3px 8px; border-radius: 6px;">Awaiting Admin Approval</span>`;
                                    } else if (req.status === 'Approved') {
                                        badge = `<span class="status ok" style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); font-weight: 600; padding: 3px 8px; border-radius: 6px;">Approved & Ready to Distribute</span>`;
                                    } else if (req.status === 'Rejected') {
                                        badge = `<span class="status danger" style="background: rgba(230,57,70,0.15); color: #ff6b6b; border: 1px solid rgba(230,57,70,0.3); font-weight: 600; padding: 3px 8px; border-radius: 6px;">Rejected by Admin</span>`;
                                    } else if (req.status && req.status.startsWith('PO Raised')) {
                                        badge = `<span class="status" style="background: rgba(67, 97, 238, 0.15); color: #4895ef; border: 1px solid rgba(67, 97, 238, 0.35); font-weight: 600; padding: 3px 8px; border-radius: 6px;">${esc(req.status)}</span>`;
                                    }
                                    const note = req.rejectReason ? `<span style="color: #ff6b6b;">${esc(req.rejectReason)}</span>` : (req.items && req.items[0]?.comment ? esc(req.items[0].comment) : '-');
                                    return `<tr>
                                        <td><strong>${esc(req.indentNumber || req.id)}</strong></td>
                                        <td>${esc(outletsData.find(o => o.id === req.outletId)?.name || req.outletName || req.outletId)}</td>
                                        <td>${esc(req.date || req.createdAt?.slice(0, 10) || '-')}</td>
                                        <td>${totalItems} item(s)</td>
                                        <td>${badge}</td>
                                        <td>${note}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : '<p style="margin-top: 18px; color: var(--text-muted); font-size: 0.88rem;">No requests submitted yet.</p>';

            content.innerHTML = `
                <div style="padding: 24px; text-align: center; background: #141416; border: 1.5px solid var(--primary, #FFBE0B); border-radius: 12px; margin-top: 10px;">
                    <h3 style="color: var(--primary, #FFBE0B); margin-top: 0; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i data-lucide="plus-circle" style="width: 22px; height: 22px;"></i> Bulk Ingredient Request for Cuisine
                    </h3>
                    <p style="color: var(--text-muted); max-width: 620px; margin: 8px auto 20px auto; font-size: 0.95rem;">
                        Select items across categories and cuisines to place a bulk ingredient request for supervisor review & admin approval.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button type="button" class="btn btn-primary" id="btnOpenBulkCuisineWizard" style="padding: 10px 24px; font-weight: 600; font-size: 0.95rem;">
                            Open Ingredient Request Screen
                        </button>
                    </div>
                    ${historyTable}
                </div>
            `;
            const btn = content.querySelector('#btnOpenBulkCuisineWizard');
            if (btn) btn.onclick = () => window.openRequestWizard?.();
            if (window.lucide) window.lucide.createIcons();
            return;
        }
        const orders=indentsData.filter(i=>i.status==='Approved' && allowedOutlets().some(o=>o.id===i.outletId) && InventoryTools.consolidatedDistributionRows(committedState,i.id).length);
        if(!orders.some(i=>i.id===distributionOrder))distributionOrder=orders[0]?.id || '';
        content.innerHTML=field('Approved consolidated order','<div id="distributionOrder"></div>')+'<div id="orderDistributionLines"></div>';
        createItemPicker(content.querySelector('#distributionOrder'),orders.map(i=>({id:i.id,name:`${i.indentNumber} · ${outletsData.find(o=>o.id===i.outletId)?.name || i.outletId}`})),{
            name:'distributionOrder',label:'Approved consolidated order',placeholder:'Search order number or outlet',selected:distributionOrder,liveCatalog:false,showAllOnFocus:true,formatOption:order=>order.name,
            onChange:id=>{if(!id)return;distributionOrder=id;orderDistribution(content);}
        });
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
        form.onsubmit=e=>{e.preventDefault();if(content.querySelector('[name=distributionOrder]').value!==distributionOrder){content.querySelector('#distributionOrder [role=combobox]').reportValidity();return;}validate();if(!form.reportValidity())return;submit(form,()=>runDatabaseAction('operations/distribution/issue',{indentId:distributionOrder,lines:rows.map((r,index)=>({requestId:r.id,quantity:Number(form.elements['quantity_'+index].value),comment:form.elements['comment_'+index].value.trim()}))}));};
    }
    function render() {
        if (!panel || !currentUser) return;
        if(currentUser.role==='executive_chef' && !['overview','history'].includes(page)){window.switchToView('operations:dashboard');return;}
        if(page==='catalog' && !canOpenCatalog()){window.switchToView('viewMasterOrders');return;}
        if (adminPages.includes(page) && currentUser.role !== 'admin') { window.switchToView('viewMasterOrders'); return; }
        panel.innerHTML = `<header class="dash-header"><div><h1>${titles[page]}</h1><p>${page==='catalog'?'Manage item details here. Receive quantities through Stock.':'Stock is held by outlet. Cuisine distributions deduct stock immediately.'}</p></div>${page==='distribute' && ['admin','purchaser'].includes(currentUser.role)?`
        <div style="display: flex; align-items: center; gap: 10px;">
            <label class="threshold-toggle" style="margin: 0; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.9rem; font-weight: 600; color: #fff;">Bulk Order / Request Mode</span>
                <span class="threshold-switch">
                    <input type="checkbox" role="switch" id="bulkCuisineModeToggle" ${bulkCuisineMode ? 'checked' : ''}>
                    <span class="threshold-track" aria-hidden="true"></span>
                </span>
                <span id="bulkCuisineModeStatus" style="font-weight: 700; color: var(--primary, #FFBE0B); min-width: 28px;">${bulkCuisineMode ? 'On' : 'Off'}</span>
            </label>
        </div>`:''}</header><div class="panel inventory-workspace" id="inventoryContent"></div>`;
        const content=panel.querySelector('#inventoryContent');
        const cuisineToggle = panel.querySelector('#bulkCuisineModeToggle');
        if (cuisineToggle) {
            cuisineToggle.onchange = e => {
                bulkCuisineMode = e.target.checked;
                panel.querySelector('#bulkCuisineModeStatus').textContent = bulkCuisineMode ? 'On' : 'Off';
                if (bulkCuisineMode && typeof window.openRequestWizard === 'function') {
                    window.openRequestWizard();
                }
                render();
            };
        }
        if(page==='stock-prices'){panel.querySelector('.dash-header p').textContent='Update unit prices for available outlet stock.';window.CurrentStockPrices.render(content);return;}
        if(page==='prices'){panel.querySelector('.dash-header p').textContent='Review recorded purchase prices and trends over time.';window.PriceHistory.render(content);return;}
        if(page==='overview') overview(content);
        if(page==='distribute'){orderDistribution(content);return;}
        if(page==='catalog') {
            const canEdit=currentUser.role==='admin';
            const item=canEdit && editing ? masterItemsData.find(i=>i.id===editing) : null;
            const locked=item && ((committedState.itemsWithHistory || []).includes(item.id) || committedState.stockHistory.some(m=>m.item_id===item.id) || item.bought>0);
            content.innerHTML=`<form id="catalogForm" class="inventory-form">
                <h3>${item?'Edit Item':'Add Catalog Item'}</h3>
                ${field('Item name',`<input name="name" required maxlength="200" value="${esc(item?.name)}">`)}
                ${field('Category',select('category',options((committedState.operationRecords || []).filter(r=>r.kind==='category'),r=>r.name,r=>r.name)))}
                ${field('Unit',select('unit',options((committedState.operationRecords || []).filter(r=>r.kind==='unit' && (!locked || r.name===item.unit)),r=>r.name,r=>r.name)))}
                <div class="threshold-setting"><label class="threshold-toggle"><span>Low-stock alerts for this item</span><span class="threshold-switch"><input type="checkbox" role="switch" name="thresholdEnabled" ${item?.thresholdEnabled===true?'checked':''}><span class="threshold-track" aria-hidden="true"></span></span><span id="thresholdToggleStatus">${item?.thresholdEnabled===true?'On':'Off'}</span></label></div>
                ${field('Threshold per outlet',`<input type="number" min="0" step="any" name="threshold" value="${esc(item?.threshold || 0)}" required>`)}
                ${canEdit?'<p><a href="#" onclick="switchToView(\'operations:category\');return false">Manage categories</a> · <a href="#" onclick="switchToView(\'operations:unit\');return false">Manage units</a></p>':''}
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
                content.querySelector('#catalogRows').innerHTML=table(['Item','Category','Unit','Vendor','Cuisine','Low-stock alerts','Status',...(canEdit?['Action']:[])],matches.map(i=>[esc(i.name)+(masterItemsData.some(other=>other.id!==i.id && other.name.trim().toLowerCase()===i.name.trim().toLowerCase())?' <small>Duplicate name — review</small>':''),esc(i.category),esc(i.unit),esc(i.vendor),esc(i.cuisine),i.thresholdEnabled===true?'On · '+esc(i.threshold ?? 0)+' '+esc(i.unit)+' per outlet':'Off',i.active===false?'Inactive':'Active',...(canEdit?[`<button class="btn btn-outline" data-edit="${esc(i.id)}">Edit</button>`]:[])]));
                content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editing=b.dataset.edit;render();});
            };renderRows();
            content.querySelector('#catalogSearch').oninput=e=>{search=e.target.value;renderRows();};
            content.querySelector('#catalogReset').onclick=()=>{editing=null;render();};
            form.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));const original=item || {id:crypto.randomUUID(),bought:0,allocations:{},consumed:{}};const value={...original,...data,active:data.active==='true',thresholdEnabled:form.elements.thresholdEnabled.checked,threshold:Number(data.threshold)};
                await submit(form,async()=>{if(item && JSON.stringify(item)!==JSON.stringify(masterItemsData.find(i=>i.id===item.id)))throw new Error('Item changed. Reopen it before saving.');await runDatabaseAction('changes',{changes:[{entity:'items',key:value.id,value}]});editing=null;});};
        }
        if(['receipt','distribute','adjust','assign'].includes(page)) {
            const items=page==='adjust'?masterItemsData:activeItems();
            const isReceipt = page === 'receipt';
            const canBulk = isReceipt && ['admin','purchaser'].includes(currentUser.role);
            let renderBatchTable;
            let isBatchSubmissionInFlight = false;
            
            content.innerHTML=`
            ${isReceipt && ['admin','purchaser'].includes(currentUser.role)?`
            <div style="margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline" data-receive-po>Receive stock from Vendor Order</button>
                    <button type="button" class="btn btn-outline ${bulkReceiptMode ? '' : 'hidden'}" id="btnToggleCsvUpload" style="display: inline-flex; align-items: center; gap: 6px; border-color: rgba(255, 190, 11, 0.4);">
                        <i data-lucide="file-up" style="width: 15px; height: 15px;"></i> Upload CSV Spreadsheet
                    </button>
                </div>
                ${canBulk ? `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label class="threshold-toggle" style="margin: 0; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.9rem; font-weight: 600; color: #fff;">Bulk Stock Mode</span>
                        <span class="threshold-switch">
                            <input type="checkbox" role="switch" id="bulkReceiptModeToggle" ${bulkReceiptMode ? 'checked' : ''}>
                            <span class="threshold-track" aria-hidden="true"></span>
                        </span>
                        <span id="bulkReceiptModeStatus" style="font-weight: 700; color: var(--primary, #FFBE0B); min-width: 28px;">${bulkReceiptMode ? 'On' : 'Off'}</span>
                    </label>
                </div>` : ''}
            </div>
            ${canBulk ? `
            <!-- CSV Upload Dropdown/Modal Area -->
            <div id="bulkCsvUploadArea" class="hidden" style="margin-bottom: 24px; padding: 20px; border: 1.5px solid var(--primary, #FFBE0B); border-radius: 12px; background: #141416; box-shadow: 0 4px 18px rgba(0,0,0,0.35);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; color: var(--primary, #FFBE0B); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="file-spreadsheet" style="width: 18px; height: 18px;"></i> Upload Bulk Stock Spreadsheet
                    </h3>
                    <button type="button" class="btn btn-outline" id="btnCloseCsvUpload" style="padding: 4px 10px; font-size: 0.8rem;">Close</button>
                </div>
                <div id="bulkCsvUploadContent"></div>
            </div>` : ''}`:''}
            <form id="outletStockForm" class="inventory-form">
            ${field('Outlet',outletSelect())}
            ${canBulk?`<div id="bulkReceiptDateField" class="${bulkReceiptMode?'':'hidden'}">${field('Receipt Date (IST)',`<input name="receiptDate" type="date" value="${InventoryTools.day()}" max="${InventoryTools.day()}">`)}</div>`:''}
            ${field('Item','<div id="stockItemPicker"></div>')}
            <p id="availableStock"></p>
            ${page==='receipt'?field('Vendor',select('vendor',options(vendorsData,v=>v.name,v=>v.name)))+field('<span id="receiptPriceLabel">Unit price (INR)</span>','<input name="unitPrice" type="number" min="0" step="0.01" required>')+'<p id="receiptTotal">Total: ₹0.00</p>':''}
            ${page==='assign'?'<p>Vendor: <strong>Legacy Stock</strong>. Quantity is added directly to this outlet’s available stock.</p>'+field('Unit price (optional, INR)','<input name="unitPrice" type="number" min="0" step="0.01">'):''}
            ${page==='distribute'?field('Cuisine',select('cuisine',options(cuisinesData,c=>c.name,c=>c.name)))+'<input type="hidden" name="requestId"><label id="requestChoiceLabel" class="hidden">Approved cuisine request<select name="requestChoice"></select></label><p id="distributionRequestHint"></p><a href="#" data-operations="deliveries">View cuisine deliveries and receipt issues</a>':''}
            ${field(page==='adjust'?'Actual on-hand quantity':'Quantity',`<span class="quantity-entry"><input name="quantity" type="number" step="any" min="${page==='adjust'?'0':'0.00000001'}" required><span class="stock-unit" aria-label="Unit"></span></span>`)}
            ${field(page==='adjust'?'Reason (required)':'Note',`<input name="reason" maxlength="500" ${page==='adjust'?'required':''}>`)}
            <button class="btn btn-primary" id="stockSubmitBtn">${isReceipt && bulkReceiptMode ? '+ Add to Batch List' : titles[page]}</button></form>
            
            ${isReceipt ? `
            <div id="bulkBatchSection" class="${bulkReceiptMode ? '' : 'hidden'}" style="margin: 28px 0 20px 0; padding: 20px; border: 1.5px solid var(--primary, #FFBE0B); border-radius: 12px; background: #141416; box-shadow: 0 4px 18px rgba(0,0,0,0.35);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h3 style="margin: 0; color: var(--primary, #FFBE0B); font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="layers" style="width: 18px; height: 18px;"></i> Current Bulk Stock Items List
                        </h3>
                        <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.85rem;">Items added manually or from CSV will accumulate here. Review and submit the entire batch.</p>
                    </div>
                    <div style="font-size: 0.95rem;">
                        <span style="color: var(--text-muted);">Total Items:</span> <strong id="bulkBatchCount" style="color: #fff;">${bulkReceiptItems.length}</strong> · 
                        <span style="color: var(--text-muted);">Total Batch Value:</span> <strong id="bulkBatchTotalValue" style="color: var(--primary, #FFBE0B);">₹0.00</strong>
                    </div>
                </div>
                <div id="bulkBatchTableContainer"></div>
                <div style="margin-top: 16px; display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-outline" id="bulkBatchClearBtn" ${bulkReceiptItems.length ? '' : 'disabled'}>Clear List</button>
                    ${currentUser.role === 'admin' ? `
                    <button type="button" class="btn btn-primary" id="bulkBatchReceiveBtn" ${bulkReceiptItems.length ? '' : 'disabled'}>
                        <i data-lucide="check-circle" style="width: 15px; height: 15px; vertical-align: middle; margin-right: 4px;"></i>Receive All Items into Stock
                    </button>
                    ` : `
                    <button type="button" class="btn btn-primary" id="bulkBatchSendApprovalBtn" ${bulkReceiptItems.length ? '' : 'disabled'}>
                        <i data-lucide="send" style="width: 15px; height: 15px; vertical-align: middle; margin-right: 4px;"></i>Send Batch for Admin Approval
                    </button>
                    `}
                </div>
            </div>

            <!-- Approval Requests for Bulk Stock (Admin only) -->
            <div id="bulkReceiptApprovalAndHistoryContainer"></div>
            ` : ''}
            
            <div id="legacyDetails"></div>`;

            const form=content.querySelector('form');
            const itemPicker = createItemPicker(content.querySelector('#stockItemPicker'),items,{onChange:()=>update(),activeOnly:page==='receipt' || page==='assign'});

            // Bulk Mode toggle handling
            if (canBulk) {
                const modeToggle = content.querySelector('#bulkReceiptModeToggle');
                const modeStatus = content.querySelector('#bulkReceiptModeStatus');
                const submitBtn = content.querySelector('#stockSubmitBtn');
                const batchSection = content.querySelector('#bulkBatchSection');

                modeToggle.onchange = () => {
                    bulkReceiptMode = modeToggle.checked;
                    modeStatus.textContent = bulkReceiptMode ? 'On' : 'Off';
                    submitBtn.textContent = bulkReceiptMode ? '+ Add to Batch List' : titles.receipt;
                    batchSection.classList.toggle('hidden', !bulkReceiptMode);
                    const dateField = content.querySelector('#bulkReceiptDateField');
                    if (dateField) dateField.classList.toggle('hidden', !bulkReceiptMode);
                    const csvBtn = content.querySelector('#btnToggleCsvUpload');
                    if (csvBtn) csvBtn.classList.toggle('hidden', !bulkReceiptMode);
                    const csvArea = content.querySelector('#bulkCsvUploadArea');
                    if (!bulkReceiptMode && csvArea) csvArea.classList.add('hidden');
                };

                const setBatchBusy = (busy) => {
                    isBatchSubmissionInFlight = !!busy;
                    const clearBtn = content.querySelector('#bulkBatchClearBtn');
                    const sendApprovalBtn = content.querySelector('#bulkBatchSendApprovalBtn');
                    const receiveBtn = content.querySelector('#bulkBatchReceiveBtn');
                    const submitBtn = content.querySelector('#stockSubmitBtn');
                    const btnToggleCSV = content.querySelector('#btnToggleCsvUpload');
                    const modeToggle = content.querySelector('#bulkReceiptModeToggle');
                    const uploadFileBtn = content.querySelector('#bulkReceiptSubmit');
                    if (clearBtn) clearBtn.disabled = busy || bulkReceiptItems.length === 0;
                    if (sendApprovalBtn) sendApprovalBtn.disabled = busy || bulkReceiptItems.length === 0;
                    if (receiveBtn) receiveBtn.disabled = busy || bulkReceiptItems.length === 0;
                    if (submitBtn) submitBtn.disabled = busy;
                    if (btnToggleCSV) btnToggleCSV.disabled = busy;
                    if (modeToggle) modeToggle.disabled = busy;
                    if (uploadFileBtn) uploadFileBtn.disabled = busy;
                };

                renderBatchTable = () => {
                    const tableContainer = content.querySelector('#bulkBatchTableContainer');
                    const countEl = content.querySelector('#bulkBatchCount');
                    const totalEl = content.querySelector('#bulkBatchTotalValue');
                    const clearBtn = content.querySelector('#bulkBatchClearBtn');
                    const sendApprovalBtn = content.querySelector('#bulkBatchSendApprovalBtn');
                    const receiveBtn = content.querySelector('#bulkBatchReceiveBtn');

                    if (!tableContainer) return;
                    countEl.textContent = bulkReceiptItems.length;
                    const totalCost = bulkReceiptItems.reduce((acc, row) => acc + (row.quantity * row.unitPrice), 0);
                    totalEl.textContent = price(Math.round(totalCost * 100));

                    if (clearBtn) clearBtn.disabled = bulkReceiptItems.length === 0;
                    if (sendApprovalBtn) sendApprovalBtn.disabled = bulkReceiptItems.length === 0;
                    if (receiveBtn) receiveBtn.disabled = bulkReceiptItems.length === 0;

                    if (!bulkReceiptItems.length) {
                        tableContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; margin: 10px 0;">No items in batch yet. Fill in the form above and click "+ Add to Batch List".</p>';
                    } else {
                        tableContainer.innerHTML = table(
                            ['#', 'Date', 'Outlet', 'Item', 'Vendor', 'Unit', 'Quantity', 'Unit Price', 'Total Cost', 'Note', 'Action'],
                            bulkReceiptItems.map((r, idx) => [
                                idx + 1,
                                esc(r.date || '—'),
                                esc(r.outletName),
                                esc(r.itemName),
                                esc(r.vendor || 'Direct Delivery'),
                                esc(r.unit),
                                numberText(r.quantity),
                                price(Math.round(r.unitPrice * 100)),
                                price(Math.round(r.quantity * r.unitPrice * 100)),
                                esc(r.note || '—'),
                                `<button type="button" class="btn btn-outline" data-remove-batch-index="${idx}" style="color: #f87171; border-color: rgba(248, 113, 113, 0.4); padding: 4px 10px; font-size: 0.8rem;">Remove</button>`
                            ])
                        );

                        tableContainer.querySelectorAll('[data-remove-batch-index]').forEach(btn => {
                            btn.onclick = () => {
                                if (isBatchSubmissionInFlight) return;
                                const idxToRemove = Number(btn.dataset.removeBatchIndex);
                                bulkReceiptItems.splice(idxToRemove, 1);
                                renderBatchTable();
                            };
                        });
                    }
                    if (window.lucide) window.lucide.createIcons();
                };

                renderBatchTable();

                // Setup CSV Upload Area Toggle
                const btnToggleCSV = content.querySelector('#btnToggleCsvUpload');
                const btnCloseCSV = content.querySelector('#btnCloseCsvUpload');
                const csvArea = content.querySelector('#bulkCsvUploadArea');
                const csvContent = content.querySelector('#bulkCsvUploadContent');

                if (btnToggleCSV && csvArea) {
                    btnToggleCSV.onclick = () => {
                        const isOpening = csvArea.classList.contains('hidden');
                        csvArea.classList.toggle('hidden', !isOpening);
                        if (isOpening && csvContent && !csvContent.dataset.rendered) {
                            csvContent.dataset.rendered = 'true';
                            window.renderBulkReceiptCSVUpload?.(csvContent, (newRows) => {
                                if (isBatchSubmissionInFlight) {
                                    window.showUiModal?.({ title: 'Submission in progress', message: 'A batch submission is currently in flight. Please wait until it completes before uploading additional rows.', type: 'warning' });
                                    return;
                                }
                                for (const row of newRows) {
                                    // Match delivery by item, outlet, date AND unit price to preserve distinct deliveries
                                    const exIdx = bulkReceiptItems.findIndex(r => 
                                        r.itemId === row.itemId && 
                                        r.outletId === row.outletId && 
                                        r.date === row.date && 
                                        Math.abs(r.unitPrice - row.unitPrice) < 0.001
                                    );
                                    if (exIdx >= 0) {
                                        bulkReceiptItems[exIdx].quantity += row.quantity;
                                        if (row.note && !bulkReceiptItems[exIdx].note.includes(row.note)) {
                                            bulkReceiptItems[exIdx].note = (bulkReceiptItems[exIdx].note + '; ' + row.note).replace(/^;\s*/, '');
                                        }
                                    } else {
                                        bulkReceiptItems.push(row);
                                    }
                                }
                                renderBatchTable();
                                window.showToast?.(`Added ${newRows.length} items from CSV to batch list`, 'success');
                            });
                        }
                    };
                }
                if (btnCloseCSV && csvArea) {
                    btnCloseCSV.onclick = () => {
                        csvArea.classList.add('hidden');
                    };
                }

                const clearBtn = content.querySelector('#bulkBatchClearBtn');
                if (clearBtn) {
                    clearBtn.onclick = () => {
                        if (!bulkReceiptItems.length) return;
                        if (confirm('Clear all items from the current batch list?')) {
                            bulkReceiptItems = [];
                            renderBatchTable();
                        }
                    };
                }

                // Send for Admin Approval (Purchaser)
                const sendApprovalBtn = content.querySelector('#bulkBatchSendApprovalBtn');
                if (sendApprovalBtn) {
                    sendApprovalBtn.onclick = async () => {
                        if (!bulkReceiptItems.length) return;
                        if (databaseWritePending || pendingChanges().length) {
                            window.showUiModal?.({ title: 'Pending changes', message: 'Finish your other pending changes before submitting.', type: 'warning' });
                            return;
                        }
                        setBatchBusy(true);
                        // Snapshot batch in flight to prevent dropping items added while request is pending
                        const batchInFlight = [...bulkReceiptItems];
                        try {
                            const csvString = window.buildBulkReceiptCSV ? window.buildBulkReceiptCSV(batchInFlight) : '';
                            const valResult = await apiRequest('stock/bulk-receipt/validate', 'POST', { csv: csvString });
                            const state = await apiRequest('stock/bulk-receipt/request', 'POST', {
                                csv: csvString,
                                revision: valResult.revision,
                                operationId: crypto.randomUUID()
                            });
                            applyServerState(state);
                            window.onLiveSyncReceived?.();
                            // Remove only the items that were submitted in this batch, keeping any newly added items
                            bulkReceiptItems = bulkReceiptItems.slice(batchInFlight.length);
                            renderBatchTable();
                            window.renderBulkReceiptApprovalAndHistory?.(content.querySelector('#bulkReceiptApprovalAndHistoryContainer'));
                            window.showUiModal?.({
                                title: 'Batch Sent for Approval',
                                message: `Successfully submitted ${batchInFlight.length} item(s) to Admin for approval. Stock will be received once approved.`,
                                type: 'success'
                            });
                        } catch (err) {
                            window.showUiModal?.({ title: 'Submission failed', message: err.message, type: 'warning' });
                        } finally {
                            setBatchBusy(false);
                        }
                    };
                }

                // Direct Receive All (Admin)
                const receiveBtn = content.querySelector('#bulkBatchReceiveBtn');
                if (receiveBtn) {
                    receiveBtn.onclick = async () => {
                        if (!bulkReceiptItems.length) return;
                        if (databaseWritePending || pendingChanges().length) {
                            window.showUiModal?.({ title: 'Pending changes', message: 'Finish your other pending changes before receiving.', type: 'warning' });
                            return;
                        }
                        if (!confirm(`Receive all ${bulkReceiptItems.length} items directly into stock?`)) return;
                        setBatchBusy(true);
                        const batchInFlight = [...bulkReceiptItems];
                        try {
                            const csvString = window.buildBulkReceiptCSV ? window.buildBulkReceiptCSV(batchInFlight) : '';
                            const valResult = await apiRequest('stock/bulk-receipt/validate', 'POST', { csv: csvString });
                            const state = await apiRequest('stock/bulk-receipt', 'POST', {
                                csv: csvString,
                                revision: valResult.revision,
                                operationId: crypto.randomUUID()
                            });
                            applyServerState(state);
                            window.onLiveSyncReceived?.();
                            bulkReceiptItems = bulkReceiptItems.slice(batchInFlight.length);
                            renderBatchTable();
                            window.renderBulkReceiptApprovalAndHistory?.(content.querySelector('#bulkReceiptApprovalAndHistoryContainer'));
                            window.showToast?.(`Received ${batchInFlight.length} bulk stock items successfully!`, 'success');
                        } catch (err) {
                            window.showUiModal?.({ title: 'Receipt failed', message: err.message, type: 'warning' });
                        } finally {
                            setBatchBusy(false);
                        }
                    };
                }

                // Render approvals & history
                window.renderBulkReceiptApprovalAndHistory?.(content.querySelector('#bulkReceiptApprovalAndHistoryContainer'));
            }

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
            form.oninput=update;
            form.onchange=()=>{OutletSelection.choose(form.elements.outletId.value);update();};
            update();

            form.onsubmit=e=>{
                e.preventDefault();
                const data=Object.fromEntries(new FormData(form));
                delete data.requestChoice;
                data.quantity=Number(data.quantity);
                if(data.unitPrice!==undefined)data.unitPrice=Number(data.unitPrice);
                if(page==='assign' && form.elements.unitPrice.value==='')delete data.unitPrice;

                // Bulk receipt mode handling
                if (isReceipt && bulkReceiptMode) {
                    if (isBatchSubmissionInFlight) {
                        window.showUiModal?.({ title: 'Submission in progress', message: 'A batch submission is currently in flight. Please wait until it completes before adding more items.', type: 'warning' });
                        return;
                    }
                    const selectedItem = masterItemsData.find(i => i.id === data.itemId);
                    if (!selectedItem) {
                        window.showUiModal?.({ title: 'Select Item', message: 'Please select an item from the catalog.', type: 'warning' });
                        return;
                    }
                    const selectedOutlet = outletsData.find(o => o.id === data.outletId);
                    const outletName = selectedOutlet?.name || data.outletId;

                    // Check duplicate in same batch list: match by item, outlet, date and unit price
                    const existingIndex = bulkReceiptItems.findIndex(r => 
                        r.itemId === selectedItem.id && 
                        r.outletId === data.outletId && 
                        r.date === (data.receiptDate || InventoryTools.day()) &&
                        Math.abs(r.unitPrice - data.unitPrice) < 0.001
                    );
                    if (existingIndex >= 0) {
                        if (!confirm(`"${selectedItem.name}" for ${outletName} on this date at ₹${data.unitPrice.toFixed(2)} is already in the batch list. Add additional quantity to it?`)) return;
                        bulkReceiptItems[existingIndex].quantity += data.quantity;
                        if (data.reason && !bulkReceiptItems[existingIndex].note.includes(data.reason)) {
                            bulkReceiptItems[existingIndex].note = (bulkReceiptItems[existingIndex].note + '; ' + data.reason).replace(/^;\s*/, '');
                        }
                    } else {
                        bulkReceiptItems.push({
                            date: data.receiptDate || InventoryTools.day(),
                            outletId: data.outletId,
                            outletName,
                            itemId: selectedItem.id,
                            itemName: selectedItem.name,
                            unit: selectedItem.unit,
                            vendor: data.vendor,
                            quantity: data.quantity,
                            unitPrice: data.unitPrice,
                            note: data.reason || ''
                        });
                    }

                    // Reset item, quantity and note input for next item entry
                    form.elements.quantity.value = '';
                    form.elements.reason.value = '';
                    if (itemPicker && itemPicker.clear) itemPicker.clear();
                    update();
                    renderBatchTable();
                    window.showToast?.(`Added "${selectedItem.name}" to batch list`, 'info');
                    return;
                }

                // Normal single stock submit
                submit(form,()=>runDatabaseAction('stock/'+(page==='assign'?'opening':page),data));
            };
        }
        if(page==='bulk-receipt') {
            window.renderBulkReceipt?.(content);
        }
        if(page==='history') {
            window.StockHistoryQueues.render(content);
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
        if(['distribute','prices','stock-prices','bulk-receipt'].includes(page) && !['admin','purchaser'].includes(currentUser.role)){window.goHome();return true;}
        if(page==='stock-prices' && !window.CurrentStockPrices?.enabled()){window.goHome();return true;}
        if(page==='catalog' && !canOpenCatalog()){window.switchToView('viewMasterOrders');return true;}
        if(adminPages.includes(page) && currentUser.role!=='admin'){window.switchToView('viewMasterOrders');return true;}
        panel?.classList.remove('hidden');render();
        document.querySelectorAll('[data-inventory]').forEach(a=>a.classList.toggle('active',a.dataset.inventory===page));
        document.getElementById('mobileActivePage').textContent=titles[page];window.NavigationGroups?.sync();
        return true;
    };
    document.addEventListener('DOMContentLoaded',()=>{
        panel=document.createElement('div');panel.id='viewInventory';panel.className='hidden';document.getElementById('viewMasterOrders').parentElement.append(panel);
        document.querySelectorAll('[data-inventory]').forEach(a=>a.onclick=e=>{
            e.preventDefault();
            window.switchToView('inventory:'+a.dataset.inventory);
        });
        document.addEventListener('click',async e=>{
            const button=e.target.closest('[data-receive-po]');if(!button)return;
            e.preventDefault();
            button.disabled=true;try {window.openVendorOrderReceiving();}catch(e){error(e);}finally{button.disabled=false;}
        });
        const oldSync=window.onLiveSyncReceived;window.onLiveSyncReceived=()=>{oldSync?.();if(currentView==='inventory:stock-prices'){window.CurrentStockPrices.refresh();return;}if(currentView==='inventory:history' && !document.activeElement?.closest('.queue-filters'))window.StockHistoryQueues.refresh();if(currentView.startsWith('inventory:') && !panel.querySelector('form') && !panel.contains(document.activeElement))render();};
        window.openAddItemModal=()=>{editing=null;window.switchToView('inventory:catalog');};
    });
})();
