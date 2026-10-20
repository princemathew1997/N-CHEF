// Workflow screens use explicit server actions; business records never live in localStorage.
(() => {
    const names={admin:'Administrator',executive_chef:'Executive Chef',purchaser:'Purchaser (Supervisor)',cuisine_head:'Cuisine Head'};
    const titles={legacy:'Bulk Legacy Stock',dashboard:'Dashboard',approvals:'Approval Queue',purchases:'Vendor Purchase Orders',deliveries:'Cuisine Deliveries',wastage:'Wastage',receipts:'Receipt Totals',accounts:'Account Requests',users:'Users',vendors:'Vendors',category:'Categories',unit:'Units',notifications:'Notifications'};
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const price=v=>v==null?'Cost unavailable':(v/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
    const records=kind=>(committedState?.operationRecords || []).filter(r=>r.kind===kind);
    const purchaser=()=>['admin','purchaser'].includes(currentUser?.role);
    const opt=(rows,value=r=>r.id,label=r=>r.name)=>rows.map(r=>`<option value="${esc(value(r))}">${esc(label(r))}</option>`).join('');
    const input=(name,label,type='text',value='',extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
    const select=(name,label,options)=>`<label>${esc(label)}<select name="${name}" required>${options}</select></label>`;
    const button=(action,id,label)=>`<button class="btn btn-outline" data-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
    const table=(heads,rows)=>`<div class="table-container"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}">No records.</td></tr>`}</tbody></table></div>`;
    const stock=(id,outlet)=>committedState.outletStock.find(b=>b.item_id===id && b.outlet_id===outlet)?.quantity || 0;
    const outletName=id=>outletsData.find(o=>o.id===id)?.name || id;
    const link=(page,text)=>`<a class="btn btn-outline" href="#" data-operations="${page}">${esc(text || titles[page])}</a>`;
    let panel,page='dashboard',editor=null,filterDate=InventoryTools.day(),filterVendor='',filterOutlet='',wasteFrom=InventoryTools.day(),wasteTo=InventoryTools.day();
    async function act(path,data){await runDatabaseAction(path,data);render();window.showToast?.('Saved successfully','success');}
    function bindForm(form,handler){form.onsubmit=async e=>{e.preventDefault();const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await handler(Object.fromEntries(new FormData(form)),form);}catch(error){window.showUiModal({title:'Change was not saved',message:error.message,type:'warning'});}finally{buttons.forEach(b=>b.disabled=false);}};}
    const formHTML=body=>`<form class="inventory-form">${body}<button class="btn btn-primary">Save</button></form>`;
    function render(){
        if(!panel || !currentUser || !committedState)return;
        panel.innerHTML=`<header class="dash-header"><div><h1>${titles[page]}</h1><p>${esc(names[currentUser.role])}</p></div></header><div class="panel inventory-workspace" id="operationsContent"></div>`;
        const content=panel.querySelector('#operationsContent');
        if(page==='legacy')window.renderLegacyImport(content);
        if(page==='dashboard'){
            const pending=indentsData.filter(i=>i.status==='Pending Approval').length;
            content.innerHTML=`<h2>Welcome, ${esc(currentUser.name)}</h2><p>${pending} consolidated requests awaiting approval · ${records('delivery').filter(d=>d.status==='Issue reported').length} delivery issues · ${records('notification').filter(n=>!n.read).length} unread notifications</p><div class="operations-links">${link('notifications')}${link('deliveries')}${purchaser()?link('approvals')+link('purchases')+link('receipts')+link('accounts'):''}${currentUser.role==='admin'?link('wastage'):''}${currentUser.role==='cuisine_head'?'<a class="btn btn-primary" href="#" data-view="viewChefPortal">My Requests</a>':''}${currentUser.role==='executive_chef'?'<a class="btn btn-primary" href="#" data-view="viewRequests">Review Cuisine Requests</a><a class="btn btn-outline" href="#" data-view="viewConsolidateRequests">Consolidate Requests</a>':''}</div>`;
            if(currentUser.role!=='cuisine_head')content.innerHTML+=`<h3>Available stock</h3><a href="#" data-view="inventory:overview">View stock by outlet and item</a>`;
        }
        if(page==='notifications')content.innerHTML=table(['When','Message','Action'],records('notification').slice().reverse().map(n=>[esc(InventoryTools.timestamp(n.createdAt)),esc(n.message),n.read?'Read':button('read',n.id,'Mark read')]));
        if(page==='category' || page==='unit'){
            content.innerHTML=formHTML(input('name','New '+page,'text','','required maxlength="200"'))+table(['Name'],records(page).map(r=>[esc(r.name)]));
            bindForm(content.querySelector('form'),data=>act('operations/'+page+'/add',data));
        }
        if(page==='approvals'){
            const indents=indentsData.filter(i=>i.status==='Pending Approval' || i.status.startsWith('PO Raised') || (i.status==='Approved' && !i.purchaseOrderIds?.length));
            content.innerHTML=indents.map(i=>`<section class="operations-card"><h3>${esc(i.indentNumber)} · ${esc(outletName(i.outletId))}</h3>${table(['Item','Requested','Revised','Available','Shortage','Unassigned central stock'],i.items.map(row=>[esc(masterItemsData.find(x=>x.id===row.itemId)?.name),esc(row.originalQty),esc(row.revisedQty),esc(stock(row.itemId,i.outletId)),esc(Math.max(0,row.revisedQty-stock(row.itemId,i.outletId))),esc(committedState.legacyStock.find(b=>b.item_id===row.itemId)?.quantity || 0)]))}<p>${i.status==='Pending Approval'?button('edit-indent',i.id,'Edit quantities'):''}${i.status!=='Approved'?button('approve-indent',i.id,'Approve for distribution'):''}${['Pending Approval','Approved'].includes(i.status)?button('raise-po',i.id,'Generate vendor orders'):''}</p></section>`).join('') || '<p>No consolidated requests awaiting approval.</p>';
            const direct=requestsData.filter(r=>!r.indentId && r.status==='Sent to Admin');
            content.innerHTML+=table(['Cuisine request','Requested','Revised','Available','Shortage','Action'],direct.map(r=>[esc(r.itemName),esc(r.qty),esc(r.revisedQty ?? r.qty),esc(stock(r.itemId,r.outletId)),esc(Math.max(0,(r.revisedQty ?? r.qty)-stock(r.itemId,r.outletId))),button('approve-request',r.id,'Edit / approve')]));
        }
        if(page==='purchases'){
            content.innerHTML=purchaseOrdersData.map(po=>`<section class="operations-card"><h3>${esc(po.poNumber)} · ${esc(po.vendorName)} · ${esc(outletName(po.outletId))}</h3><p>${esc(po.status)}</p>${table(['Item','Quantity','Received'],po.items.map(i=>[esc(i.itemName),esc(i.qty),esc(i.receivedQty || 0)]))}${purchaser() && po.status!=='Received'?`<form class="inventory-form" data-po="${esc(po.id)}">${po.items.filter(i=>i.qty>(i.receivedQty || 0)).map(i=>input(i.itemId,`${i.itemName} — unit price (INR)`,'number','','required min="0" step="0.01"')).join('')}<p class="po-total">Total: ₹0.00</p><button class="btn btn-primary">Receive order</button></form>`:''}${button('pdf',po.id,'Download vendor PDF')}</section>`).join('') || '<p>No purchase orders.</p>';
            content.querySelectorAll('[data-po]').forEach(form=>{
                const po=purchaseOrdersData.find(p=>p.id===form.dataset.po);
                form.oninput=()=>{form.querySelector('.po-total').textContent='Total: '+price(po.items.reduce((sum,i)=>sum+Math.round((i.qty-(i.receivedQty || 0))*Math.round(Number(form.elements.namedItem(i.itemId)?.value || 0)*100)),0));};
                bindForm(form,data=>act('purchase-orders/receive',{poId:po.id,prices:Object.fromEntries(Object.entries(data).map(([key,value])=>[key,Number(value)]))}));
            });
        }
        if(page==='receipts'){
            if(!filterOutlet || !outletsData.some(o=>o.id===filterOutlet))filterOutlet=outletsData[0]?.id || '';
            if(!filterVendor || !vendorsData.some(v=>v.name===filterVendor))filterVendor=vendorsData[0]?.name || '';
            const receipts=committedState.stockHistory.filter(m=>m.kind==='receipt' && m.outlet_id===filterOutlet && m.vendor===filterVendor && InventoryTools.day(m.created_at)===filterDate);
            const total=receipts.reduce((sum,r)=>sum+(r.total_cost_minor || 0),0),unknown=receipts.some(r=>r.total_cost_minor==null);
            const saved=records('reconciliation').find(r=>r.outletId===filterOutlet && r.vendor===filterVendor && r.date===filterDate);
            content.innerHTML=`<div class="inventory-form" id="receiptFilters">${input('date','Date (IST)','date',filterDate,'required')}${select('outlet','Outlet',opt(outletsData))}${select('vendor','Vendor',opt(vendorsData,r=>r.name))}</div>${table(['Time','Item','Quantity','Unit price','Line total'],receipts.map(r=>[esc(InventoryTools.timestamp(r.created_at)),esc(r.item_name),esc(r.delta),price(r.unit_cost_minor),price(r.total_cost_minor)]))}<h3>Entered stock total: ${price(total)}</h3>${unknown?'<p>Some historical receipts have no cost; this total includes priced receipts only.</p>':''}${formHTML(input('vendorTotal','Vendor invoice goods total (INR)','number',saved?saved.vendorTotalMinor/100:'','required min="0" step="0.01"')+'<p id="invoiceDifference"></p>')}`;
            const filters=content.querySelector('#receiptFilters');filters.querySelector('[name=outlet]').value=filterOutlet;filters.querySelector('[name=vendor]').value=filterVendor;
            filters.onchange=()=>{filterDate=filters.querySelector('[name=date]').value;filterOutlet=filters.querySelector('[name=outlet]').value;filterVendor=filters.querySelector('[name=vendor]').value;render();};
            const form=content.querySelector('form');const difference=()=>{content.querySelector('#invoiceDifference').textContent=form.elements.vendorTotal.value===''?'Enter vendor total to compare.':'Vendor total − stock total: '+price(Math.round(Number(form.elements.vendorTotal.value)*100)-total);};form.oninput=difference;difference();
            bindForm(form,data=>act('operations/receipts/reconcile',{outletId:filterOutlet,vendor:filterVendor,date:filterDate,vendorTotal:Number(data.vendorTotal)}));
        }
        if(page==='deliveries')content.innerHTML=table(['When','Outlet / cuisine','Item','Issued / received','Status / reason','Action'],records('delivery').slice().reverse().map(d=>[esc(InventoryTools.timestamp(d.createdAt)),esc(outletName(d.outletId)+' / '+d.cuisine),esc(d.itemName),esc(d.quantity+' / '+(d.receivedQuantity ?? 'Awaiting')),esc(d.status+(d.reason?' — '+d.reason:'')+(d.resolution?' — '+d.resolution:'')+(d.message?' — '+d.message:'')),currentUser.role==='cuisine_head' && d.status==='Issued'?button('confirm-delivery',d.id,'Confirm / report issue'):purchaser() && d.status==='Issue reported'?button('resolve-delivery',d.id,'Resolve issue'):'']));
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
            content.innerHTML=userForm(user)+table(['Name','Username','Role','Outlets','Action'],usersData.map(u=>[esc(u.name),esc(u.username),esc(names[u.role]),esc(u.assignedLocations.map(outletName).join(', ')),button('edit-user',u.id,'Edit')+(u.id!==currentUser.id?button('deactivate-user',u.id,'Deactivate'):'')]));
            bindForm(content.querySelector('form'),async(data,form)=>{if(user && JSON.stringify(user)!==JSON.stringify(usersData.find(u=>u.id===user.id)))throw new Error('User changed. Reopen the account before saving.');const value=readUser(data,form,user);await act('changes',{changes:[{entity:'users',key:value.id,value}]});editor=null;render();});
        }
    }
    function userForm(user={},requestedRole){
        return formHTML(input('name','Full name','text',user.name || '','required maxlength="200"')+input('username','Username','text',user.username || '','required minlength="3" maxlength="64"')+input('password',user.id?'New password (optional)':'Password','password','',`${user.id?'':'required'} minlength="12" maxlength="128" autocomplete="new-password"`)+select('role','Role',opt(requestedRole?[requestedRole]:Object.keys(names),r=>r,r=>names[r]))+`<fieldset><legend>Assigned outlets (Admin has all outlets)</legend>${outletsData.map(o=>`<label><input type="checkbox" name="outlet_${esc(o.id)}" value="${esc(o.id)}" ${(user.assignedLocations || []).includes(o.id)?'checked':''}>${esc(o.name)}</label>`).join('')}</fieldset><fieldset><legend>Assigned cuisines (required for Cuisine Head)</legend>${cuisinesData.map(c=>`<label><input type="checkbox" name="cuisine_${esc(c.id)}" value="${esc(c.name)}" ${(user.assignedSections || user.assignedCuisines || []).includes(c.name)?'checked':''}>${esc(c.name)}</label>`).join('')}</fieldset>`);
    }
    function readUser(data,form,user){const value={...user,id:user?.id || crypto.randomUUID(),name:data.name,username:data.username,role:data.role,title:names[data.role],assignedLocations:data.role==='admin'?['all']:Array.from(form.querySelectorAll('[name^=outlet_]:checked'),e=>e.value),assignedSections:Array.from(form.querySelectorAll('[name^=cuisine_]:checked'),e=>e.value)};value.assignedCuisines=value.assignedSections;if(data.password)value.password=data.password;return value;}
    function editorForm(title,html,handler){
        const dialog=document.createElement('dialog');dialog.className='operations-dialog';dialog.innerHTML=`<h2>${esc(title)}</h2>${html}<button class="btn btn-outline" type="button" data-close>Cancel</button>`;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();bindForm(dialog.querySelector('form'),async(data,form)=>{await handler(data,form);dialog.close();});return dialog;
    }
    async function handle(action,id){
        if(action==='read')return act('operations/notifications/read',{id});
        if(action==='approve-indent')return act('indents/approve',{indentId:id});
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
            const d=records('delivery').find(r=>r.id===id);
            return editorForm('Confirm delivery / report issue',formHTML(input('receivedQuantity','Actual quantity received','number',d.quantity,`required min="0" max="${d.quantity}" step="any"`)+select('reason','Outcome',opt(['Received in full','Less quantity','Not available','Quality issues','Other'],r=>r,r=>r))+input('affectedQuantity','Affected quantity (for issue)','number',0,`min="0" max="${d.quantity}" step="any"`)+input('message','Message (required for Other)','text','','maxlength="500"')),data=>act('operations/deliveries/confirm',{id,receivedQuantity:Number(data.receivedQuantity),affectedQuantity:Number(data.affectedQuantity),reject:data.reason!=='Received in full',reason:data.reason,message:data.message}));
        }
        if(action==='resolve-delivery'){
            const d=records('delivery').find(r=>r.id===id),physical=['Quality issues','Other'].includes(d.reason) && d.affectedQuantity<=d.receivedQuantity;
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
        document.getElementById('navAddChef')?.classList.add('hidden');
        if(currentUser.role==='purchaser'){document.getElementById('navGroupRequests')?.classList.add('hidden');}
        document.querySelectorAll('[data-inventory]').forEach(a=>{
            const p=a.dataset.inventory;
            const visible=currentUser.role==='admin' || (currentUser.role==='purchaser' && !['catalog','assign','cuisines'].includes(p)) || (currentUser.role==='executive_chef' && ['overview','history'].includes(p));
            a.classList.toggle('hidden',!visible);
        });
    };
    function allowed(p){if(['users','vendors','category','unit','wastage'].includes(p))return currentUser?.role==='admin';if(['legacy','approvals','purchases','receipts','accounts'].includes(p))return purchaser();return true;}
    window.showOperationsView=view=>{
        const aliases={viewUsers:'users',viewVendors:'vendors',viewIndents:'purchases',viewAddChef:'accounts'};
        if(aliases[view])view='operations:'+aliases[view];
        if(!view.startsWith('operations:'))return false;
        page=view.slice(11);if(!titles[page] || !allowed(page))page='dashboard';editor=null;panel?.classList.remove('hidden');
        document.getElementById('mobileActivePage').textContent=titles[page];
        if(page==='legacy'){
            document.getElementById('navStockSubmenu')?.classList.add('open');
            document.getElementById('navStock')?.classList.add('active');
            const chevron=document.getElementById('navStockChevron');if(chevron)chevron.style.transform='rotate(180deg)';
        }
        render();return true;
    };
    document.addEventListener('DOMContentLoaded',()=>{
        panel=document.createElement('div');panel.id='viewOperations';panel.className='hidden';document.getElementById('viewMasterOrders').parentElement.append(panel);
        const nav=document.querySelector('.nav-menu');
        for(const p of ['dashboard','approvals','purchases','deliveries','receipts','accounts','wastage','notifications']){const a=document.createElement('a');a.href='#';a.className='nav-item';a.dataset.operations=p;a.dataset.operationsNav='true';a.textContent=titles[p];nav.append(a);}
        document.querySelectorAll('.sidebar-logo .logo-mark,.mobile-logo').forEach(logo=>{logo.setAttribute('role','button');logo.tabIndex=0;logo.onclick=e=>{if(!e.target.closest('button'))window.switchToView('operations:dashboard');};logo.onkeydown=e=>{if(e.target===logo && ['Enter',' '].includes(e.key)){e.preventDefault();logo.click();}};});
        document.addEventListener('click',async e=>{
            const link=e.target.closest('[data-operations],[data-view]');if(link){e.preventDefault();window.switchToView(link.dataset.operations?'operations:'+link.dataset.operations:link.dataset.view);return;}
            const b=e.target.closest('#viewOperations [data-action]');if(!b)return;e.preventDefault();b.disabled=true;try{await handle(b.dataset.action,b.dataset.id);}catch(error){window.showUiModal({title:'Action unavailable',message:error.message,type:'warning'});}finally{b.disabled=false;}
        });
        const old=window.onLiveSyncReceived;window.onLiveSyncReceived=()=>{old?.();const alerts=document.querySelector('[data-operations-nav][data-operations=notifications]');if(alerts)alerts.textContent='Notifications ('+records('notification').filter(n=>!n.read).length+')';if(currentView.startsWith('operations:') && !panel.querySelector('form') && !document.querySelector('.operations-dialog'))render();};
    });
})();
