// Workflow screens use explicit server actions; business records never live in localStorage.
(() => {
    const names={admin:'Administrator',executive_chef:'Executive Chef',purchaser:'Purchaser (Supervisor)',cuisine_head:'Cuisine Head'};
    const titles={legacy:'Bulk Legacy Stock',approvals:'Approval Queue','vendor-orders':'Generate Vendor Orders',purchases:'Vendor Purchase Orders',deliveries:'Cuisine Deliveries',wastage:'Wastage',receipts:'Receipt Totals',accounts:'Account Requests',users:'Users',vendors:'Vendors',category:'Categories',unit:'Units',notifications:'Notifications'};
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const price=v=>v==null?'Cost unavailable':(v/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
    const records=kind=>kind==='notification'?getVisibleNotifications():(committedState?.operationRecords || []).filter(r=>r.kind===kind);
    const purchaser=()=>['admin','purchaser'].includes(currentUser?.role);
    const opt=(rows,value=r=>r.id,label=r=>r.name)=>rows.map(r=>`<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');
    const input=(name,label,type='text',value='',extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
    const select=(name,label,options)=>`<label>${esc(label)}<select name="${name}" required>${options}</select></label>`;
    const button=(action,id,label)=>`<button class="btn btn-outline" data-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
    const table=(heads,rows)=>`<div class="table-container"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}">No records.</td></tr>`}</tbody></table></div>`;
    const stock=(id,outlet)=>committedState.outletStock.find(b=>b.item_id===id && b.outlet_id===outlet)?.quantity || 0;
    const receiptComparisons=po=>(po.receiptEvents || []).filter(event=>event.vendorInvoiceTotalMinor!=null).map(event=>`<p>Receipt ${esc(InventoryTools.timestamp(event.receivedAt))}: Our total: <strong>${price(event.stockTotalMinor)}</strong> · Vendor invoice: <strong>${price(event.vendorInvoiceTotalMinor)}</strong> · Difference (vendor − ours): <strong>${price(event.invoiceDifferenceMinor)}</strong></p>`).join('');
    const outletName=id=>outletsData.find(o=>o.id===id)?.name || id;
    const pageTitle=key=>key==='deliveries' && currentUser?.role==='cuisine_head'?'Receive Order':titles[key];
    const link=(page,text)=>`<a class="btn btn-outline" href="#" data-operations="${page}">${esc(text || pageTitle(page))}</a>`;
    let panel,page='approvals',editor=null,filterDate=InventoryTools.day(),filterVendor='',filterOutlet='',wasteFrom=InventoryTools.day(),wasteTo=InventoryTools.day();
    let purchaseSection='open',purchaseFrom='',purchaseTo='';
    const purchaseDates={open:{from:'',to:''},received:null};
    async function act(path,data){await runDatabaseAction(path,data);render();window.showToast?.('Saved successfully','success');}
    function bindForm(form,handler){configureUserAssignments(form);form.onsubmit=async e=>{e.preventDefault();const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await handler(Object.fromEntries(new FormData(form)),form);}catch(error){window.showUiModal({title:'Change was not saved',message:error.message,type:'warning'});}finally{buttons.forEach(b=>b.disabled=false);}};}
    const formHTML=body=>`<form class="inventory-form">${body}<button class="btn btn-primary">Save</button></form>`;
    function render(){
        if(!panel || !currentUser || !committedState)return;
        panel.innerHTML=`<header class="dash-header"><div><h1>${page==='deliveries' && currentUser.role==='cuisine_head'?'Receive Order':titles[page]}</h1><p>${esc(names[currentUser.role])}</p></div></header><div class="panel inventory-workspace" id="operationsContent"></div>`;
        const content=panel.querySelector('#operationsContent');
        if(page==='legacy')window.renderLegacyImport(content);
        if(page==='notifications')content.innerHTML=`<div class="notification-actions"><button type="button" class="btn btn-outline" data-action="read-all" ${(committedState.unreadNotificationCount ?? records('notification').filter(n=>!n.read).length)?'':'disabled'}>Mark all as read</button></div>`+table(['When','Message','Action'],records('notification').slice().reverse().map(n=>[esc(InventoryTools.timestamp(n.createdAt)),esc(n.message),(n.eventType==='delivery_issued'?link('deliveries',currentUser.role==='cuisine_head'?'Receive Order':'Confirm delivery')+' ':' ')+(n.read?'Read':button('read',n.id,'Mark read'))]));
        if(page==='category' || page==='unit'){
            content.innerHTML=formHTML(input('name','New '+page,'text','','required maxlength="200"'))+table(['Name'],records(page).map(r=>[esc(r.name)]));
            bindForm(content.querySelector('form'),data=>act('operations/'+page+'/add',data));
        }
        if(['approvals','vendor-orders'].includes(page)){
            const ordering=page==='vendor-orders';
            const indents=indentsData.filter(i=>ordering?i.status==='Approved' && !i.purchaseOrderIds?.length:i.status==='Pending Approval');
            content.innerHTML=`<div class="approval-request-list">${indents.map(i=>`<section class="operations-card approval-request-card" data-approval-request="${esc(i.id)}" aria-label="${esc(i.indentNumber)}"><header class="approval-request-header"><div><small>Consolidated request</small><h3>${esc(i.indentNumber)}</h3><p>Outlet: <strong>${esc(outletName(i.outletId))}</strong> · ${i.items.length} item(s)${i.supervisorName?' · Executive Chef: '+esc(i.supervisorName):''}</p></div><span class="approval-request-status ${i.status==='Pending Approval'?'awaiting':'approved'}">${i.status==='Pending Approval'?'Awaiting approval':esc(i.status)}</span></header>${table(['Item','Requested','Revised','Available','Shortage'],i.items.map(row=>[esc(masterItemsData.find(x=>x.id===row.itemId)?.name),esc(row.originalQty),esc(row.revisedQty),esc(stock(row.itemId,i.outletId)),esc(Math.max(0,row.revisedQty-stock(row.itemId,i.outletId)))]))}<footer class="approval-request-actions">${i.status==='Pending Approval'?button('edit-indent',i.id,'Edit quantities')+button('approve-indent',i.id,'Approve for order'):''}${ordering?button('raise-po',i.id,'Generate vendor orders'):''}</footer></section>`).join('')}</div>`;
            const direct=ordering?[]:requestsData.filter(r=>!r.indentId && r.status==='Sent to Admin');
            if(direct.length)content.innerHTML+=`<section class="operations-card approval-request-card direct-request-card"><header class="approval-request-header"><div><small>Individual requests</small><h3>Cuisine requests awaiting approval</h3></div></header>${table(['Cuisine request','Requested','Revised','Available','Shortage','Action'],direct.map(r=>[esc(r.itemName),esc(r.qty),esc(r.revisedQty ?? r.qty),esc(stock(r.itemId,r.outletId)),esc(Math.max(0,(r.revisedQty ?? r.qty)-stock(r.itemId,r.outletId))),button('approve-request',r.id,'Edit / approve')]))}</section>`;
            if(!indents.length && !direct.length)content.innerHTML=ordering?'<p>No approved requests awaiting vendor orders.</p>':'<p>No requests awaiting approval.</p>';
        }
        if(page==='purchases'){
            const filteredOrders=InventoryTools.purchaseOrderList(purchaseOrdersData,purchaseSection,purchaseFrom,purchaseTo);
            content.innerHTML=`<div class="vendor-order-list">${filteredOrders.map(po=>`<section class="operations-card approval-request-card vendor-order-card" data-vendor-order="${esc(po.id)}" aria-label="${esc(po.poNumber)}"><header class="approval-request-header"><div><small>Vendor purchase order</small><h3>${esc(po.vendorName)}</h3><p class="vendor-order-number">PO: <strong>${esc(po.poNumber)}</strong></p><p>Outlet: <strong>${esc(outletName(po.outletId))}</strong> · ${po.items.length} item(s)</p></div><span class="approval-request-status ${po.status==='Received'?'approved':'awaiting'}">${esc(po.status)}</span></header>${table(['Item','Ordered','Accepted','Rejected','Remaining'],po.items.map(i=>{const unit=i.unit || masterItemsData.find(x=>x.id===i.itemId)?.unit || '';return [esc(i.itemName),esc(i.qty)+' '+esc(unit),esc(i.receivedQty || 0)+' '+esc(unit),esc(i.rejectedQty || 0)+' '+esc(unit),esc(Math.max(0,i.qty-(i.receivedQty || 0)))+' '+esc(unit)];}))}${purchaser() && po.status!=='Received'?`<div class="vendor-order-receiving">${button('receive-po',po.id,'Receive order')}</div>`:''}<footer class="approval-request-actions">${button('pdf',po.id,'Download vendor PDF')}</footer></section>`).join('')}</div>`;
            if(purchaseSection==='received')content.innerHTML='<div class="received-order-list">'+table(['Received on (IST)','PO number','Vendor','Outlet','Items','Action'],filteredOrders.map(po=>[esc(InventoryTools.timestamp(po.receivedAt)),esc(po.poNumber),esc(po.vendorName),esc(outletName(po.outletId)),esc(po.items.length),button('view-received-po',po.id,'View details')+button('pdf',po.id,'Download PDF')]))+'</div>';
            if(!filteredOrders.length)content.innerHTML='<p>No '+(purchaseSection==='received'?'received orders':'outstanding purchase orders')+' match the selected dates.</p>';
            const controls=`<div class="purchase-order-tabs"><button type="button" class="btn ${purchaseSection==='open'?'btn-primary':'btn-outline'}" data-purchase-section="open">PO Raised (${purchaseOrdersData.filter(p=>p.status!=='Received').length})</button><button type="button" class="btn ${purchaseSection==='received'?'btn-primary':'btn-outline'}" data-purchase-section="received">Received (${purchaseOrdersData.filter(p=>p.status==='Received').length})</button></div><div class="user-table-filters"><label>From date (IST)<input id="purchaseFrom" type="date" value="${esc(purchaseFrom)}"></label><label>To date (IST)<input id="purchaseTo" type="date" value="${esc(purchaseTo)}"></label><button type="button" class="btn btn-outline" id="purchaseClearDates">Clear dates</button><span>${purchaseSection==='received'?'Filter by received date':'Filter by order date'} · ${filteredOrders.length} order(s)</span></div>`;
            content.insertAdjacentHTML('afterbegin',controls);
            content.querySelectorAll('[data-purchase-section]').forEach(b=>b.onclick=()=>{
                purchaseDates[purchaseSection]={from:purchaseFrom,to:purchaseTo};
                purchaseSection=b.dataset.purchaseSection;
                const dates=purchaseDates[purchaseSection] || {from:InventoryTools.day(),to:InventoryTools.day()};
                purchaseFrom=dates.from;purchaseTo=dates.to;render();
            });
            const changeDates=()=>{const from=content.querySelector('#purchaseFrom'),to=content.querySelector('#purchaseTo');to.setCustomValidity(from.value && to.value && from.value>to.value?'To date must be on or after From date.':'');if(!to.reportValidity())return;purchaseFrom=from.value;purchaseTo=to.value;render();};
            content.querySelector('#purchaseFrom').onchange=changeDates;content.querySelector('#purchaseTo').onchange=changeDates;
            content.querySelector('#purchaseClearDates').onclick=()=>{purchaseFrom='';purchaseTo='';render();};
        }
        if(page==='receipts'){
            if(!filterOutlet || !outletsData.some(o=>o.id===filterOutlet))filterOutlet=outletsData[0]?.id || '';
            if(!filterVendor || !vendorsData.some(v=>v.name===filterVendor))filterVendor=vendorsData[0]?.name || '';
            const receipts=committedState.stockHistory.filter(m=>m.kind==='receipt' && m.outlet_id===filterOutlet && m.vendor===filterVendor && InventoryTools.day(m.created_at)===filterDate);
            let total=receipts.reduce((sum,r)=>sum+(r.total_cost_minor || 0),0);const unknown=receipts.some(r=>r.total_cost_minor==null);
            const saved=records('reconciliation').find(r=>r.outletId===filterOutlet && r.vendor===filterVendor && r.date===filterDate);
            content.innerHTML=`<div class="inventory-form" id="receiptFilters">${input('date','Date (IST)','date',filterDate,'required')}${select('outlet','Outlet',opt(outletsData))}${select('vendor','Vendor',opt(vendorsData,r=>r.name))}</div>${table(['Time','Item','Quantity','Unit price','Line total'],receipts.map(r=>[esc(InventoryTools.timestamp(r.created_at)),esc(r.item_name),esc(r.delta),price(r.unit_cost_minor),price(r.total_cost_minor)]))}<h3>Entered stock total: ${price(total)}</h3>${unknown?'<p>Some historical receipts have no cost; this total includes priced receipts only.</p>':''}${formHTML(input('vendorTotal','Vendor invoice goods total (INR)','number',saved?saved.vendorTotalMinor/100:'','required min="0" step="0.01"')+'<p id="invoiceDifference"></p>')}`;
            const filters=content.querySelector('#receiptFilters');filters.querySelector('[name=outlet]').value=filterOutlet;filters.querySelector('[name=vendor]').value=filterVendor;
            filters.onchange=()=>{filterDate=filters.querySelector('[name=date]').value;filterOutlet=filters.querySelector('[name=outlet]').value;filterVendor=filters.querySelector('[name=vendor]').value;render();};
            const form=content.querySelector('form');const difference=()=>{content.querySelector('#invoiceDifference').textContent=form.elements.vendorTotal.value===''?'Enter vendor total to compare.':'Vendor total − stock total: '+price(Math.round(Number(form.elements.vendorTotal.value)*100)-total);};form.oninput=difference;difference();
            bindForm(form,data=>act('operations/receipts/reconcile',{outletId:filterOutlet,vendor:filterVendor,date:filterDate,vendorTotal:Number(data.vendorTotal)}));
            if(committedState.historyPaged){
                apiRequest('stock/history?'+new URLSearchParams({type:'receipt',outlet:filterOutlet,vendor:filterVendor,from:filterDate,to:filterDate,limit:100})).then(result=>{
                    if(!content.isConnected)return;
                    total=result.totals.totalCostMinor;
                    content.querySelector('.table-container').outerHTML=table(['Time','Item','Quantity','Unit price','Line total'],result.rows.map(r=>[esc(InventoryTools.timestamp(r.created_at)),esc(r.item_name),esc(r.delta),price(r.unit_cost_minor),price(r.total_cost_minor)]));
                    content.querySelector('h3').textContent='Entered stock total: '+price(total)+(result.totals.unknownCosts?' (unpriced receipts excluded)':'');
                    if(result.nextCursor)content.querySelector('h3').insertAdjacentHTML('beforebegin','<p>Showing the latest 100 receipts. The total includes all matching receipts; use Stock History to browse every movement.</p>');
                    difference();
                }).catch(error=>{if(content.isConnected)window.showToast(error.message,'warning');});
            }
        }
        if(page==='deliveries')window.DeliveryQueues.render(content);
        if(page==='wastage'){
            content.innerHTML=`<div class="inventory-form" id="wasteFilters">${select('period','Period','<option value="daily">Daily</option><option value="weekly">Last 7 days</option><option value="custom">Custom</option>')}${input('from','From (IST)','date',wasteFrom)}${input('to','To (IST)','date',wasteTo)}<button class="btn btn-outline" id="applyWaste">Apply</button></div><div id="wasteRows"></div>`;
            const filters=content.querySelector('#wasteFilters');filters.querySelector('[name=period]').onchange=e=>{if(e.target.value!=='custom'){wasteTo=InventoryTools.day();wasteFrom=e.target.value==='daily'?wasteTo:InventoryTools.day(Date.now()-6*86400000);filters.querySelector('[name=from]').value=wasteFrom;filters.querySelector('[name=to]').value=wasteTo;}};
            const draw=()=>{wasteFrom=filters.querySelector('[name=from]').value;wasteTo=filters.querySelector('[name=to]').value;try{InventoryTools.bounds(wasteFrom,wasteTo);}catch(e){content.querySelector('#wasteRows').textContent=e.message;return;}const rows=records('wastage').filter(r=>InventoryTools.day(r.createdAt)>=wasteFrom && InventoryTools.day(r.createdAt)<=wasteTo);content.querySelector('#wasteRows').innerHTML=table(['Date','Outlet','Item','Quantity','Reason','Person','Value'],rows.map(r=>[esc(InventoryTools.timestamp(r.createdAt)),esc(outletName(r.outletId)),esc(r.itemName),esc(r.quantity+' '+r.unit),esc(r.reason),esc(r.actorName),price(r.totalCostMinor)]))+`<p>Total recorded value: ${price(rows.reduce((sum,r)=>sum+(r.totalCostMinor || 0),0))}${rows.some(r=>r.totalCostMinor==null)?' (unpriced wastage excluded)':''}</p>`;};content.querySelector('#applyWaste').onclick=draw;draw();
        }
        if(page==='accounts'){
            content.innerHTML=currentUser.role==='purchaser'?formHTML(input('name','Requested person name','text','','required maxlength="200"')+select('role','Role',opt(['cuisine_head','executive_chef'],r=>r,r=>names[r]))+select('outletId','Outlet',opt(outletsData))+select('cuisine','Cuisine',opt(cuisinesData,r=>r.name))):'';
            content.innerHTML+=table(['Name','Role','Outlet','Status','Action'],records('account_request').map(r=>[esc(r.name),esc(names[r.role]),esc(outletName(r.outletId)),esc(r.status+(r.reason?' — '+r.reason:'')),currentUser.role==='admin' && r.status==='Pending'?button('account-approve',r.id,'Approve / set credentials')+button('account-reject',r.id,'Reject'):'']));
            const form=content.querySelector('form');if(form)bindForm(form,data=>act('operations/accounts/request',data));
        }
        if(page==='vendors'){
            const vendor=vendorsData.find(v=>v.id===editor);
            content.innerHTML=formHTML(input('name','Vendor name','text',vendor?.name || '','required maxlength="200"')+input('phone','Phone number','tel',vendor?.phone || '')+input('gstin','GSTIN','text',vendor?.gstin || '','maxlength="15"')+input('fromDate','Vendor from date','date',vendor?.fromDate || InventoryTools.day(),'required'))+table(['Name','Phone','GSTIN','Vendor from','Action'],vendorsData.map(v=>[esc(v.name),esc(v.phone),esc(v.gstin),esc(v.fromDate),button('edit-vendor',v.id,'Edit')]));
            bindForm(content.querySelector('form'),async data=>{if(vendor && JSON.stringify(vendor)!==JSON.stringify(vendorsData.find(v=>v.id===vendor.id)))throw new Error('Vendor changed. Reopen it before saving.');const value={...vendor,...data,gstin:data.gstin.trim().toUpperCase(),id:vendor?.id || crypto.randomUUID()};await act('changes',{changes:[{entity:'vendors',key:value.id,value}]});editor=null;render();});
        }
        if(page==='users'){
            const user=usersData.find(u=>u.id===editor);
            const admin=currentUser.role==='admin';
            content.innerHTML=(admin?userForm(user):'<p>Users available within your role and assigned outlets.</p>')+
                `<div class="user-table-filters"><label>Outlet<select id="userOutletFilter"><option value="">All outlets</option>${opt(outletsData)}</select></label><label>Role<select id="userRoleFilter"><option value="">All roles</option>${opt(Object.keys(names).filter(role=>admin || usersData.some(u=>u.role===role)),r=>r,r=>names[r])}</select></label><button type="button" class="btn btn-outline" id="userFilterReset">Clear filters</button><span id="userFilterCount" aria-live="polite"></span></div><div id="userTableRows"></div>`;
            const renderUsers=()=>{
                const outlet=content.querySelector('#userOutletFilter').value,role=content.querySelector('#userRoleFilter').value;
                const users=usersData.filter(u=>(!role || u.role===role) && (!outlet || u.role==='admin' || (u.assignedLocations || []).some(id=>id==='all' || id===outlet)));
                content.querySelector('#userTableRows').innerHTML=table(['Name','Username','Role','Outlets','Action'],users.map(u=>[esc(u.name),esc(u.username),esc(names[u.role]),u.role==='admin'?'All outlets':esc((u.assignedLocations || []).map(outletName).join(', ')),admin?button('edit-user',u.id,'Edit')+(u.id!==currentUser.id?button('deactivate-user',u.id,'Deactivate'):''):'—']));
                content.querySelector('#userFilterCount').textContent=users.length+' of '+usersData.length+' users';
            };
            content.querySelector('#userOutletFilter').onchange=renderUsers;
            content.querySelector('#userRoleFilter').onchange=renderUsers;
            content.querySelector('#userFilterReset').onclick=()=>{content.querySelector('#userOutletFilter').value='';content.querySelector('#userRoleFilter').value='';renderUsers();};
            renderUsers();
            if(admin)bindForm(content.querySelector('form'),async(data,form)=>{if(user && JSON.stringify(user)!==JSON.stringify(usersData.find(u=>u.id===user.id)))throw new Error('User changed. Reopen the account before saving.');const value=readUser(data,form,user);await act('changes',{changes:[{entity:'users',key:value.id,value}]});editor=null;render();});
        }
    }
    function configureUserAssignments(form){
        const role=form.querySelector('select[name=role]');
        if(!role || !form.querySelector('[data-user-assignment]'))return;
        const update=()=>form.querySelectorAll('[data-user-assignment]').forEach(section=>{
            const visible=section.dataset.userAssignment==='outlets'?role.value!=='admin':role.value==='cuisine_head';
            section.hidden=!visible;
            section.style.display=visible?'':'none';
            section.disabled=!visible;
        });
        role.addEventListener('change',update);update();
    }
    function userForm(user={},requestedRole){
        return formHTML(input('name','Full name','text',user.name || '','required maxlength="200"')+input('username','Username','text',user.username || '','required minlength="3" maxlength="64"')+input('password',user.id?'New password (optional)':'Password','password','',`${user.id?'':'required'} minlength="4" maxlength="128" autocomplete="new-password"`)+select('role','Role',opt(requestedRole?[requestedRole]:Object.keys(names),r=>r,r=>names[r]).replace('value="'+esc(requestedRole || user.role || 'admin')+'"','value="'+esc(requestedRole || user.role || 'admin')+'" selected'))+`<fieldset class="assignment-options" data-user-assignment="outlets"><legend>Assigned outlets</legend>${outletsData.map(o=>`<label class="assignment-option"><input type="checkbox" name="outlet_${esc(o.id)}" value="${esc(o.id)}" ${(user.assignedLocations || []).includes(o.id)?'checked':''}><span>${esc(o.name)}</span></label>`).join('')}</fieldset><fieldset class="assignment-options" data-user-assignment="cuisines"><legend>Assigned cuisines</legend>${cuisinesData.map(c=>`<label class="assignment-option"><input type="checkbox" name="cuisine_${esc(c.id)}" value="${esc(c.name)}" ${(user.assignedSections || user.assignedCuisines || []).includes(c.name)?'checked':''}><span>${esc(c.name)}</span></label>`).join('')}</fieldset>`);
    }
    function readUser(data,form,user){const value={...user,id:user?.id || crypto.randomUUID(),name:data.name,username:data.username,role:data.role,title:names[data.role],assignedLocations:data.role==='admin'?['all']:Array.from(form.querySelectorAll('[name^=outlet_]:checked'),e=>e.value),assignedSections:data.role==='cuisine_head'?Array.from(form.querySelectorAll('[name^=cuisine_]:checked'),e=>e.value):[]};value.assignedCuisines=value.assignedSections;if(data.password)value.password=data.password;return value;}
    function editorForm(title,html,handler){
        const dialog=document.createElement('dialog');dialog.className='operations-dialog';dialog.innerHTML=`<h2>${esc(title)}</h2>${html}<button class="btn btn-outline" type="button" data-close>Cancel</button>`;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();bindForm(dialog.querySelector('form'),async(data,form)=>{await handler(data,form);dialog.close();});return dialog;
    }
    async function handle(action,id){
        if(action==='accept-dispatch')return window.DeliveryQueues.accept(id,act);
        if(action==='read-all'){
            return act('operations/notifications/read-all',{});
        }
        if(action==='read')return act('operations/notifications/read',{id});
        if(action==='approve-indent')return act('indents/approve',{indentId:id});
        if(action==='view-received-po'){
            const po=purchaseOrdersData.find(p=>p.id===id);if(!po)return;
            const dialog=document.createElement('dialog');dialog.className='operations-dialog';dialog.innerHTML=`<h2>${esc(po.poNumber)} · ${esc(po.vendorName)}</h2><p>Outlet: ${esc(outletName(po.outletId))} · Received: ${esc(InventoryTools.timestamp(po.receivedAt))}</p>${receiptComparisons(po)}${table(['Item','Unit','Ordered','Received','Rejected'],po.items.map(i=>[esc(i.itemName),esc(i.unit || masterItemsData.find(x=>x.id===i.itemId)?.unit),esc(i.qty),esc(i.receivedQty || 0),esc(i.rejectedQty || 0)]))}<button type="button" class="btn btn-outline" data-close>Close</button>`;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();return;
        }
        if(action==='receive-po'){
            const po=purchaseOrdersData.find(p=>p.id===id);
            const rows=po.items.filter(i=>i.qty>(i.receivedQty || 0));
            const html=formHTML(`<p>Received means accepted into stock. Enter rejected goods separately; they are not charged and remain outstanding for replacement.</p><div class="vendor-receipt-table">${table(['Item / unit','Outstanding','Received','Rejected','Unit cost (INR)','Received total','Rejection reason / note'],rows.map((line,index)=>{
                const remaining=line.qty-(line.receivedQty || 0),unit=line.unit || masterItemsData.find(i=>i.id===line.itemId)?.unit || '';
                return [esc(line.itemName)+' ('+esc(unit)+')',esc(remaining),`<input aria-label="Received ${esc(line.itemName)}" name="received_${index}" type="number" min="0" max="${remaining}" step="any" value="${remaining}" required>`,`<input aria-label="Rejected ${esc(line.itemName)}" name="rejected_${index}" type="number" min="0" max="${remaining}" step="any" value="0" required>`,`<input aria-label="Unit cost ${esc(line.itemName)}" name="cost_${index}" type="number" min="0" step=".01">`,`<output data-line-total="${index}"></output>`,`<select aria-label="Rejection reason ${esc(line.itemName)}" name="reason_${index}"><option value="">Choose reason</option>${opt(['Quality issues','Damaged goods','Wrong item','Other'],r=>r,r=>r)}</select><input aria-label="Rejection note ${esc(line.itemName)}" name="message_${index}" maxlength="500" placeholder="Note (required for Other)">`];
            }))}</div><p id="vendorReceiveTotal">Our received stock total: ₹0.00</p>${input('vendorInvoiceTotal','Vendor invoice total for this receipt (INR, optional)','number','','min="0" step="0.01"')}<p id="vendorInvoiceDifference" aria-live="polite"></p><small>Compare the invoice amount for this receipt with the accepted stock total. A positive difference means the vendor amount is higher.</small>${receiptComparisons(po)}`);
            const dialog=editorForm('Receive '+po.poNumber+' · '+po.vendorName,html,(data,form)=>act('purchase-orders/receive',{poId:id,vendorInvoiceTotal:data.vendorInvoiceTotal===''?undefined:Number(data.vendorInvoiceTotal),lines:rows.map((line,index)=>({itemId:line.itemId,receivedQuantity:Number(data['received_'+index]),rejectedQuantity:Number(data['rejected_'+index]),unitPrice:data['cost_'+index]===''?undefined:Number(data['cost_'+index]),reason:data['reason_'+index],message:data['message_'+index]}))}));
            dialog.classList.add('vendor-receipt-dialog');
            const form=dialog.querySelector('form');form.querySelector('button[type=submit],button.btn-primary').textContent='Save received stock';
            const update=()=>{let total=0;rows.forEach((line,index)=>{
                const received=form.elements['received_'+index],rejected=form.elements['rejected_'+index],cost=form.elements['cost_'+index],reason=form.elements['reason_'+index],message=form.elements['message_'+index];
                const remaining=line.qty-(line.receivedQty || 0);received.max=Math.max(0,remaining-Number(rejected.value || 0));rejected.max=Math.max(0,remaining-Number(received.value || 0));cost.required=Number(received.value)>0;reason.required=Number(rejected.value)>0;message.required=Number(rejected.value)>0 && reason.value==='Other';
                const amount=Math.round(Math.max(0,Number(received.value))*Math.round(Number(cost.value || 0)*100));total+=amount;form.querySelector('[data-line-total="'+index+'"]').textContent=price(amount);
            });form.querySelector('#vendorReceiveTotal').textContent='Our received stock total: '+price(total);const invoice=form.elements.vendorInvoiceTotal.value;form.querySelector('#vendorInvoiceDifference').textContent=invoice===''?'Enter the vendor invoice total to compare.':'Difference (vendor − ours): '+price(Math.round(Number(invoice)*100)-total);};form.oninput=update;form.onchange=update;update();return dialog;
        }
        if(action==='raise-po'){activeReviewingIndentId=id;return window.VendorOrderUI.open();}
        if(action==='pdf')return window.VendorOrderUI.download(id);
        if(action==='edit-vendor' || action==='edit-user'){editor=id;render();if(action==='edit-user')panel.querySelector('[name=role]').value=usersData.find(u=>u.id===id).role;return;}
        if(action==='deactivate-user'){if(await window.showConfirmModal('Deactivate this user?'))return act('changes',{changes:[{entity:'users',key:id,value:null}]});return;}
        if(action==='approve-request'){
            const r=requestsData.find(r=>r.id===id);return editorForm('Approve cuisine request',formHTML(input('quantity','Approved quantity','number',r.revisedQty ?? r.qty,'required min="0.000001" step="any"')),data=>act('requests/approve',{requestId:id,quantity:Number(data.quantity)}));
        }
        if(action==='edit-indent'){
            const indent=indentsData.find(i=>i.id===id);
            if(indent.status!=='Pending Approval')throw new Error('Vendor orders already raised; quantities are locked.');
            const requests=requestsData.filter(r=>r.indentId===id);
            const fields=requests.length?requests.map(r=>input(r.id,`${r.itemName} / ${r.cuisine}`,'number',r.revisedQty ?? r.qty,'required min="0" step="any"')).join(''):indent.items.map(i=>input(i.itemId,masterItemsData.find(x=>x.id===i.itemId)?.name,'number',i.revisedQty,'required min="0" step="any"')).join('');
            return editorForm('Revise consolidated quantities',formHTML(fields),data=>{
                if(JSON.stringify(indent)!==JSON.stringify(indentsData.find(i=>i.id===id)))throw new Error('Order changed. Reopen the order before saving.');
                const modified=requests.map(r=>({...r,revisedQty:Number(data[r.id])}));
                const value={...indent,items:indent.items.map(i=>{const linked=modified.filter(r=>r.itemId===i.itemId);const revisedQty=requests.length?linked.reduce((s,r)=>s+r.revisedQty,0):Number(data[i.itemId]);return {...i,revisedQty,...(i.cuisineBreakdown?{cuisineBreakdown:i.cuisineBreakdown.map(b=>({...b,qty:linked.filter(r=>r.cuisine===b.cuisine).reduce((s,r)=>s+r.revisedQty,0)}))}:{})};})};
                return act('changes',{changes:[{entity:'indents',key:id,value},...modified.map(value=>({entity:'requests',key:value.id,value}))]});
            });
        }
        if(action==='confirm-delivery'){
            const d=window.DeliveryQueues?.find(id) || records('delivery').find(r=>r.id===id);
            return editorForm('Confirm delivery / report issue',formHTML(input('receivedQuantity','Actual quantity received','number',d.quantity,`required min="0" max="${d.quantity}" step="any"`)+select('reason','Outcome',opt(['Received in full','Less quantity','Not available','Quality issues','Other'],r=>r,r=>r))+input('affectedQuantity','Affected quantity (for issue)','number',0,`min="0" max="${d.quantity}" step="any"`)+input('message','Message (required for Other)','text','','maxlength="500"')),data=>act('operations/deliveries/confirm',{id,receivedQuantity:Number(data.receivedQuantity),affectedQuantity:Number(data.affectedQuantity),reject:data.reason!=='Received in full',reason:data.reason,message:data.message}));
        }
        if(action==='resolve-delivery'){
            const d=window.DeliveryQueues?.find(id) || records('delivery').find(r=>r.id===id),physical=['Quality issues','Other'].includes(d.reason) && d.affectedQuantity<=d.receivedQuantity;
            return editorForm('Resolve delivery issue',formHTML(select('resolution','Resolution',opt(physical?['replacement','return','wastage']:['replacement','shortage'],r=>r,r=>({replacement:'Issue replacement',shortage:'Confirm shortage',return:'Return usable stock',wastage:'Record confirmed wastage'}[r])))+(physical?select('disposition','If replacing: handling of rejected goods','<option value="">Choose when issuing replacement</option><option value="wastage">Confirmed wastage</option><option value="return">Return usable stock</option>').replace(' required',''):'')+input('note','Resolution note','text','','required maxlength="500"')),data=>act('operations/deliveries/resolve',{id,...data}));
        }
        if(action==='account-reject')return editorForm('Reject account request',formHTML(input('reason','Reason','text','','required maxlength="500"')),data=>act('operations/accounts/resolve',{id,approve:false,...data}));
        if(action==='account-approve'){
            const r=records('account_request').find(r=>r.id===id);return editorForm('Approve account and confirm assignments',userForm({name:r.name,assignedLocations:[r.outletId],assignedSections:r.cuisine?[r.cuisine]:[]},r.role),(data,form)=>act('operations/accounts/resolve',{id,approve:true,user:readUser(data,form)}));
        }
    }
    window.configureOperationsRole=()=>{
        document.getElementById('userTitle').textContent=names[currentUser.role];
        document.querySelectorAll('[data-operations-nav]').forEach(a=>{const p=a.dataset.operations;a.classList.toggle('hidden',!allowed(p));});
        document.getElementById('navGroupStock')?.classList.toggle('hidden',currentUser.role==='cuisine_head');
        document.getElementById('navReceiveOrder')?.classList.toggle('hidden',currentUser.role!=='cuisine_head');
        document.getElementById('navIndents')?.classList.toggle('hidden',!purchaser());
        document.getElementById('navAddChef')?.classList.add('hidden');
        document.getElementById('navUsers')?.classList.toggle('hidden',currentUser.role==='cuisine_head');
        document.getElementById('navGroupLegacy')?.classList.toggle('hidden',!purchaser());
        document.getElementById('navManageRequests')?.classList.toggle('hidden',currentUser.role==='purchaser');
        document.querySelectorAll('[data-inventory]').forEach(a=>{
            const p=a.dataset.inventory;
            const visible=currentUser.role==='admin' || (currentUser.role==='purchaser' && !['catalog','cuisines'].includes(p)) || (currentUser.role==='executive_chef' && ['overview','history'].includes(p));
            a.classList.toggle('hidden',!visible);
        });
        window.NavigationGroups?.configure();
    };
    function allowed(p){if(p==='users')return ['admin','purchaser','executive_chef'].includes(currentUser?.role);if(['vendors','category','unit','wastage'].includes(p))return currentUser?.role==='admin';if(['legacy','approvals','vendor-orders','purchases','receipts','accounts'].includes(p))return purchaser();return true;}
    window.openVendorOrderReceiving=()=>{
        if(!allowed('purchases'))return;
        purchaseDates[purchaseSection]={from:purchaseFrom,to:purchaseTo};
        purchaseSection='open';purchaseFrom='';purchaseTo='';
        purchaseDates.open={from:'',to:''};
        window.switchToView('operations:purchases');
    };
    window.homeViewForRole=role=>({admin:'viewMasterOrders',executive_chef:'viewRequests',purchaser:'operations:approvals',cuisine_head:'viewChefPortal'}[role] || 'viewMasterOrders');
    window.goHome=()=>window.switchToView(window.homeViewForRole(currentUser?.role));
    window.showOperationsView=view=>{
        if(view==='operations:dashboard'){window.goHome();return true;}
        if(view==='viewRequests' && currentUser?.role==='purchaser')view='operations:approvals';

        const aliases={viewUsers:'users',viewVendors:'vendors',viewIndents:'purchases',viewAddChef:'accounts'};
        if(aliases[view])view='operations:'+aliases[view];
        if(!view.startsWith('operations:'))return false;
        page=view.slice(11);if(!titles[page] || !allowed(page)){window.goHome();return true;}editor=null;currentView='operations:'+page;localStorage.setItem('nchef_active_view',currentView);panel?.classList.remove('hidden');
        document.getElementById('mobileActivePage').textContent=pageTitle(page);
        document.querySelectorAll('[data-operations-nav]').forEach(a=>a.classList.toggle('active',a.dataset.operations===page));
        if(page==='users')document.getElementById('navUsers')?.classList.add('active');
        if(page==='purchases')document.getElementById('navIndents')?.classList.add('active');
        render();window.NavigationGroups?.sync();return true;
    };
    document.addEventListener('DOMContentLoaded',()=>{
        panel=document.createElement('div');panel.id='viewOperations';panel.className='hidden';document.getElementById('viewMasterOrders').parentElement.append(panel);
        document.querySelectorAll('.sidebar-logo .logo-mark,.mobile-logo').forEach(logo=>{logo.setAttribute('role','button');logo.tabIndex=0;logo.onclick=e=>{if(!e.target.closest('button'))window.goHome();};logo.onkeydown=e=>{if(e.target===logo && ['Enter',' '].includes(e.key)){e.preventDefault();logo.click();}};});
        document.addEventListener('click',async e=>{
            const link=e.target.closest('[data-operations],[data-view]');if(link){e.preventDefault();window.switchToView(link.dataset.operations?'operations:'+link.dataset.operations:link.dataset.view);return;}
            const b=e.target.closest('#viewOperations [data-action]');if(!b)return;e.preventDefault();b.disabled=true;try{await handle(b.dataset.action,b.dataset.id);}catch(error){window.showUiModal({title:'Action unavailable',message:error.message,type:'warning'});}finally{b.disabled=false;}
        });
        const old=window.onLiveSyncReceived;window.onLiveSyncReceived=()=>{old?.();if(typeof updateRequestsBadge==='function')updateRequestsBadge();if(currentView==='operations:deliveries' && !document.activeElement?.closest('.queue-filters') && !document.querySelector('.operations-dialog'))window.DeliveryQueues.refresh();if(currentView.startsWith('operations:') && !panel.querySelector('form') && !document.querySelector('.operations-dialog'))render();};
    });
})();
