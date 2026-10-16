// Local-only documentation fixture and screenshots. Start scripts/qa-server.mjs first.
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const runtimeRequire = process.env.NCHEF_PLAYWRIGHT_ROOT ? createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT, 'package.json')) : require;
const { chromium } = runtimeRequire('playwright');
const base = 'http://127.0.0.1:8888';
const output = resolve('docs/user-guides/images');
const password = 'documentation-only-2026';
const checks = [];
const limitations = [];
let browser, page;
async function api(path, input) {
  const response = await page.request.fetch(base + '/api/' + path, { method: input ? 'POST' : 'GET', headers: { Origin: base }, data: input });
  const result = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(result));
  return result;
}
async function command(path, input) { const s = await api('state'); return api(path, {...input, revision:s.revision, operationId:crypto.randomUUID()}); }
async function login(username, secret=password) {
  await page.goto(base); await page.request.post(base+'/api/logout',{headers:{Origin:base}}); await page.reload();
  await page.locator('#username').fill(username); await page.locator('#password').fill(secret); await page.locator('#loginBtn').click();
  await page.waitForFunction(()=>document.querySelector('#page-dashboard').classList.contains('active'));
}
async function closeNotice() { await page.evaluate(()=>document.querySelector('#uiAlertModal')?.classList.add('hidden')); }
async function view(name) { await closeNotice(); await page.evaluate(v=>{document.querySelectorAll('.modal').forEach(e=>e.classList.add('hidden'));window.switchToView(v);},name); await page.waitForTimeout(150); }
async function shot(name, selectors, crop) {
  await page.locator('#page-loader').waitFor({state:'hidden'});
  if(name==='sign-in') {
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#page-login')).opacity)>.99);
    const r=await page.locator('.login-box').boundingBox();crop={x:r.x-24,y:r.y-24,width:r.width+48,height:r.height+48};
  }
  await page.evaluate(()=>{const toast=document.querySelector('#uiFloatingToast');if(toast)toast.style.display='none';});
  if (crop === main) {
    crop = await page.evaluate(()=>{
      const root=document.querySelector('.main-content');const r=root.getBoundingClientRect();
      const bottoms=[...root.querySelectorAll('h1,h2,h3,p,button,input,select,table')].map(e=>e.getBoundingClientRect()).filter(b=>b.width&&b.height&&b.top<1000).map(b=>b.bottom);
      const x=Math.floor(r.left),y=Math.max(0,Math.floor(r.top));
      return {x,y,width:Math.min(1440-x,Math.ceil(r.width)),height:Math.min(1000-y,Math.ceil(Math.max(...bottoms)-y+24))};
    });
  } else if (crop) {
    crop = await page.evaluate(()=>{
      const e=document.querySelector('#requestWizardModal:not(.hidden) > .panel, #modalVendorPO:not(.hidden) > .panel, #modalIndentApproval:not(.hidden) > .panel');
      if(!e)return null;const r=e.getBoundingClientRect();const x=Math.max(0,Math.floor(r.x)-20),y=Math.max(0,Math.floor(r.y)-20);
      return {x,y,width:Math.min(1440-x,Math.ceil(r.width)+40),height:Math.min(1000-y,Math.ceil(r.height)+40)};
    }) || crop;
  }
  await page.evaluate(selectors=>{
    document.querySelectorAll('.guide-callout').forEach(e=>e.remove());
    selectors.forEach((s,i)=>{const e=document.querySelector(s); if(!e)throw Error('Missing callout '+s);const r=e.getBoundingClientRect();const b=document.createElement('div');b.className='guide-callout';b.textContent=i+1;b.style.cssText=`position:fixed;left:${Math.max(2,r.left-14)}px;top:${Math.max(2,r.top-12)}px;background:#ffbe0b;color:#111;border:2px solid white;border-radius:50%;width:28px;height:28px;font:bold 16px Arial;display:grid;place-items:center;z-index:100000;box-shadow:0 1px 5px #000`;document.body.append(b);});
  },selectors);
  await page.screenshot({path:resolve(output,name+'.png'), ...(crop?{clip:crop}:{})});
  await page.evaluate(()=>document.querySelectorAll('.guide-callout').forEach(e=>e.remove()));
}
const main={x:270,y:0,width:1170,height:1000};
async function done(label) { checks.push(label); console.log('Verified: '+label); }
(async()=>{
 mkdirSync(output,{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.NCHEF_BROWSER_PATH?{executablePath:process.env.NCHEF_BROWSER_PATH}:{channel:'msedge'})});
 page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1.5});
 page.on('dialog',d=>d.accept());
 await page.goto(base); await shot('sign-in',['#username','#password','#loginBtn']);
 await login('qa_admin','qa-only-password-2026');
 const initial=await api('state');
 if(process.argv.includes('--refresh-overview')) {
   await view('viewMasterOrders');await page.evaluate(()=>{OutletSelection.choose('brigade');renderOutletDashboard();});await shot('master-orders',['#masterStockFilters','#inventoryTableBody'],main);
   return;
 }
 assert.equal(initial.users.length,1,'Restart disposable QA server before capture.');
 await view('viewUsers');
 await page.locator('#supFullName').fill('Sample Supervisor'); await page.locator('#supUsername').fill('guide_supervisor'); await page.locator('#supPassword').fill(password);
 await page.locator('#userSectionSupervisor input[type=checkbox]').evaluateAll(es=>es.forEach(e=>{e.checked=e.value==='brigade';}));
 await page.locator('#btnSaveSupervisorSubmit').click(); await page.waitForTimeout(600);
 assert.ok((await api('state')).users.some(u=>u.username==='guide_supervisor')); await done('Admin creates supervisor');
 await shot('admin-users',['#supFullName','#supOutletCheckboxes','#btnSaveSupervisorSubmit'].filter(s=>s!=='#supOutletCheckboxes'),main);
 await view('viewLocations'); await page.locator('#newLocationId').fill('sample-outlet');await page.locator('#newLocationName').fill('SAMPLE OUTLET');await shot('admin-locations',['#newLocationId','#newLocationName','#saveLocationBtn'],main);await page.locator('#saveLocationBtn').click();await page.waitForTimeout(300);assert.ok((await api('state')).outlets.some(o=>o.id==='sample-outlet'));await done('Admin creates location');
 await view('viewVendors');await page.locator('#newVendorName').fill('Sample Supplier'); await shot('admin-vendors',['#newVendorName','#addVendorBtn'],main);await page.locator('#addVendorBtn').click();await page.waitForTimeout(300);assert.ok((await api('state')).vendors.some(v=>v.name==='Sample Supplier'));await done('Admin creates vendor');
 await view('inventory:cuisines'); await page.locator('#inventoryContent input[name=name]').fill('Sample Kitchen'); await page.locator('#inventoryContent button').click(); await page.waitForTimeout(300); await done('Admin adds cuisine');
 await view('inventory:catalog'); await page.locator('#catalogForm [name=name]').fill('Sample rice'); await page.locator('#catalogForm [name=category]').fill('Training'); await page.locator('#catalogForm [name=unit]').fill('kg'); await page.locator('#catalogForm button').first().click(); await page.waitForTimeout(350);
 const item=(await api('state')).items.find(i=>i.name==='Sample rice'); assert.ok(item); await done('Admin creates catalog item');
 await shot('admin-catalog',['#catalogForm [name=name]','#catalogForm [name=unit]','#catalogForm button'],main);
 await login('guide_supervisor'); await view('viewAddChef');
 await page.locator('#chefFullName').fill('Sample Chef');await page.locator('#chefUsername').fill('guide_chef');await page.locator('#chefPassword').fill(password);await page.locator('.chef-cuisine-cb[value=Indian]').check();await page.locator('#btnSaveChefSubmit').click();await page.waitForTimeout(500);
 assert.ok((await api('state')).users.some(u=>u.username==='guide_chef')); await done('Supervisor creates chef');
 await shot('supervisor-chefs',['#chefFullName','#chefOutletDisplay','#chefCuisineCheckboxes','#btnSaveChefSubmit'].filter(s=>s!=='#chefCuisineCheckboxes'),main);
 await page.evaluate(()=>editChefUser('guide_chef'));await page.locator('.chef-cuisine-cb[value=Tandoor]').check();await page.locator('#btnSaveChefSubmit').click();await page.waitForTimeout(300);await done('Supervisor edits chef cuisine');
 await view('inventory:receipt');await page.getByRole('combobox',{name:'Item name'}).fill('Sample rice');await page.getByRole('option',{name:'Sample rice (kg)',exact:true}).click();await page.locator('#outletStockForm [name=quantity]').fill('20');await shot('supervisor-receipt',['#stockItemPicker','#outletStockForm [name=vendor]','#outletStockForm [name=quantity]','#outletStockForm button.btn-primary'],main);await page.locator('#outletStockForm button.btn-primary').click();await page.waitForTimeout(350);await done('Supervisor receives stock');
 await login('guide_chef');await shot('chef-home',['#chefAllocatedOutletBadge','#chefAllocatedCuisineBadge','#btnChefPortalRaiseRequest'],main);
 await page.evaluate(()=>openRequestWizard());await page.getByRole('button',{name:'Training',exact:true}).click();await page.locator('#wizardItemsGrid .panel').click();
 await shot('chef-select',['#wizardCuisine','#wizardCategoryTabs','#wizardReviewBtn'],{x:310,y:50,width:820,height:900});
 await page.locator('#wizardReviewBtn').click();await page.locator('[id^=wizardQty_]').fill('3');await shot('chef-review',['#wizardReviewTableBody input','#wizardSubmitBtn'],{x:310,y:50,width:820,height:900});await page.locator('#wizardSubmitBtn').click();await page.waitForTimeout(500);await closeNotice();
 assert.equal((await api('state')).requests[0].status,'Pending');await done('Chef submits request');await shot('chef-tracking',['#chefPortalRequestsTableBody'],main);
 await login('guide_supervisor');await page.evaluate(()=>openRequestWizard());await page.getByRole('button',{name:'Training',exact:true}).click();await page.locator('#wizardCuisine').selectOption('Tandoor');await page.locator('#wizardItemsGrid .panel').click();await page.locator('#wizardReviewBtn').click();await page.locator('[id^=wizardQty_]').fill('2');await page.locator('#wizardSubmitBtn').click();await page.waitForTimeout(350);await closeNotice();await done('Supervisor submits own requirement');
 await view('viewConsolidateRequests');await page.locator('[data-cuisine-qty]').first().fill('2.5');await page.locator('input[placeholder="Reason / note..."]').fill('Adjusted to daily kitchen plan');
 await shot('supervisor-consolidate',['[data-cuisine-qty]','input[placeholder="Reason / note..."]','#btnWsSubmitIndentMid'],main);
 await page.evaluate(()=>{void submitWorkspaceConsolidatedIndent();}); await page.waitForTimeout(150);
 const confirm=page.locator('#uiAlertModal button').filter({hasText:'Send Request To Admin'});await confirm.click();await page.waitForTimeout(500);await closeNotice();
 const state=await api('state');assert.equal(state.indents.length,1);await done('Supervisor revises and consolidates requests');
 await login('qa_admin','qa-only-password-2026');await view('viewRequests');await page.evaluate(id=>openIndentApprovalModal(id),state.indents[0].id);
 await shot('admin-approval',['#btnRejectIndent','#btnRaiseVendorPO','#btnApproveIndent'],{x:220,y:20,width:1000,height:960});
 await page.locator('#btnApproveIndent').click();await page.waitForTimeout(400);await closeNotice();assert.equal((await api('state')).indents[0].status,'Approved');await done('Admin approval distributes stock');
 await view('inventory:history');await shot('stock-history',['#historyRows'],main);
 await view('viewMasterOrders');await page.evaluate(()=>{OutletSelection.choose('brigade');renderOutletDashboard();});await shot('master-orders',['#masterStockFilters','#inventoryTableBody'],main);
 await view('inventory:overview');await shot('admin-overview',['#overviewRows'],main);
 // Make two further real requests to exercise rejection and the alternative purchase-order route.
 for(const route of ['reject','purchase']) {
   await login('guide_chef');await page.evaluate(()=>openRequestWizard());await page.getByRole('button',{name:'Training',exact:true}).click();await page.locator('#wizardItemsGrid .panel').click();await page.locator('#wizardReviewBtn').click();await page.locator('[id^=wizardQty_]').fill('1');await page.locator('#wizardSubmitBtn').click();await page.waitForTimeout(350);
   await login('guide_supervisor');await view('viewConsolidateRequests');await page.evaluate(()=>{void submitWorkspaceConsolidatedIndent();});await page.locator('#uiAlertOkBtn').click();await page.waitForTimeout(400);
   await login('qa_admin','qa-only-password-2026');const pending=(await api('state')).indents.find(i=>i.status==='Pending Approval');assert.ok(pending);await view('viewRequests');await page.evaluate(id=>openIndentApprovalModal(id),pending.id);
   if(route==='reject') {await page.locator('#btnRejectIndent').click();await page.locator('#uiAlertInput').fill('Sample revised kitchen plan');await page.locator('#uiAlertOkBtn').click();await page.waitForTimeout(400);assert.equal((await api('state')).indents.find(i=>i.id===pending.id).status,'Rejected');await done('Admin rejects consolidated request');}
   else {
     await page.locator('#btnRaiseVendorPO').click();await shot('admin-purchase-order',['.po-item-qty','.po-item-vendor','.po-item-note','#btnConfirmSendPO'],{x:150,y:20,width:1140,height:960});
     const saved=page.waitForResponse(r=>r.url().endsWith('/api/purchase-orders/raise')&&r.request().method()==='POST');await page.locator('#btnConfirmSendPO').click();const response=await saved;
     assert.equal(response.status(),200,JSON.stringify(await response.json()));await page.locator('#poVendorResults').waitFor({state:'visible'});await shot('admin-vendor-results',['#poVendorResults [data-po-pdf]','#poVendorResults [data-po-print]'],{x:150,y:20,width:1140,height:960});await done('Admin creates vendor orders with individual downloads');
     await view('viewVendors');await page.locator('[data-receive-po]').scrollIntoViewIfNeeded();await shot('admin-existing-orders',['[data-receive-po]'],main);await page.locator('[data-receive-po]').click();await page.waitForTimeout(400);assert.equal((await api('state')).purchase_orders[0].status,'Received');await done('Admin receives a vendor purchase order through Vendors');
     limitations.push('Sidebar Purchase Orders opens consolidated requests; actual PO table is in the Admin Vendors screen, so Supervisor has no normal PO receiving navigation.');
   }
 }
 await login('qa_admin','qa-only-password-2026');
 // Additional local-only checks use real stock commands, with server-side validation.
 await command('stock/adjust',{itemId:item.id,outletId:'brigade',quantity:18,reason:'Sample physical count'});await done('Adjustment sets actual on-hand balance');
 await view('inventory:adjust');await shot('stock-adjust',['#outletStockForm [name=quantity]','#outletStockForm [name=reason]'],main);
 await command('stock/distribute',{itemId:item.id,outletId:'brigade',quantity:1,cuisine:'Indian',reason:'Sample separate issue'});await done('Separate distribution deducts stock');
 await view('inventory:distribute');await shot('stock-distribute',['#stockItemPicker','#outletStockForm [name=cuisine]','#outletStockForm [name=quantity]'],main);
 writeFileSync(resolve('docs/user-guides/validation.json'),JSON.stringify({date:'2026-10-16',environment:'Disposable in-memory QA server; fictional users and transactions',checks,limitations},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();});
