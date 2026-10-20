// Run against the disposable qa-server only. No production credentials or cloud writes.
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {mkdirSync}=require('node:fs');
const assert=require('node:assert/strict');
const req=createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT,'package.json'));
const {chromium}=req('playwright');
const base='http://127.0.0.1:8888';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const errors=[];
 const admin=await browser.newPage({viewport:{width:1440,height:1000}});
 admin.on('pageerror',e=>errors.push(e.message));
 const login=async(page,user)=>{await page.goto(base);await page.locator('#username').fill(user);await page.locator('#password').fill('qa-only-password-2026');await page.locator('#loginBtn').click();await page.locator('#viewOperations h1').filter({hasText:'Dashboard'}).waitFor();await page.locator('#page-loader').waitFor({state:'hidden'});};
 await login(admin,'qa_admin');
 const api=async(page,path,input)=>{const r=await page.request.fetch(base+'/api/'+path,{method:input?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json'},data:input});const data=await r.json();assert.equal(r.status(),200,JSON.stringify(data));return data;};
 const cmd=async(page,path,input)=>api(page,path,{...input,revision:(await api(page,'state')).revision,operationId:crypto.randomUUID()});
 await admin.locator('#navUsers').click();
 const form=admin.locator('#operationsContent form');
 await form.locator('[name=name]').fill('QA Purchaser');await form.locator('[name=username]').fill('qa_purchaser');await form.locator('[name=password]').fill('qa-only-password-2026');await form.locator('[name=role]').selectOption('purchaser');await form.locator('[name=outlet_brigade]').check();await form.locator('button[type=submit],button.btn-primary').click();
 await admin.locator('#operationsContent td').filter({hasText:'QA Purchaser'}).waitFor();
 const users=[{id:crypto.randomUUID(),username:'qa_exec',name:'QA Executive Chef',role:'executive_chef',assignedLocations:['brigade'],password:'qa-only-password-2026'},{id:crypto.randomUUID(),username:'qa_head',name:'QA Cuisine Head',role:'cuisine_head',assignedLocations:['brigade'],assignedSections:['Indian'],password:'qa-only-password-2026'}];
 await cmd(admin,'changes',{changes:users.map(value=>({entity:'users',key:value.id,value}))});await admin.evaluate(()=>refreshDatabase());
 await admin.locator('[data-operations-nav][data-operations=category]').click();await admin.locator('#operationsContent [name=name]').fill('QA Category');await admin.locator('#operationsContent form button').click();await admin.locator('#operationsContent td').filter({hasText:'QA Category'}).waitFor();
 await admin.locator('[data-inventory=catalog]').click();
 await admin.locator('#catalogForm [name=name]').fill('QA priced item');await admin.locator('#catalogForm [name=category]').selectOption('QA Category');await admin.locator('#catalogForm [name=unit]').selectOption('kg');await admin.locator('#catalogForm [name=thresholdEnabled]').check();await admin.locator('#catalogForm [name=threshold]').fill('3');await admin.locator('#catalogForm .btn-primary').click();await admin.locator('#catalogRows td').filter({hasText:'QA priced item'}).waitFor();
 const purchaser=await browser.newPage({viewport:{width:1440,height:1000}});purchaser.on('pageerror',e=>errors.push(e.message));await login(purchaser,'qa_purchaser');
 if(!await purchaser.locator('[data-inventory=receipt]').isVisible())await purchaser.locator('#navStock').click();await purchaser.locator('[data-inventory=receipt]').click();
 await purchaser.locator('#stockItemPicker [role=combobox]').fill('QA priced');await purchaser.locator('#stockItemPicker [role=option]').first().click();await purchaser.locator('#outletStockForm [name=quantity]').fill('5');await purchaser.locator('#outletStockForm [name=unitPrice]').fill('12.50');assert.match(await purchaser.locator('#receiptTotal').innerText(),/62.50/);await purchaser.locator('#outletStockForm .btn-primary').click();
 await purchaser.locator('[data-operations-nav][data-operations=receipts]').click();await purchaser.locator('#operationsContent [name=vendorTotal]').fill('65');assert.match(await purchaser.locator('#invoiceDifference').innerText(),/2.50/);await purchaser.locator('#operationsContent form .btn-primary').click();
 // Catalog refresh must preserve unfinished stock form input and update the open picker.
 if(!await purchaser.locator('[data-inventory=receipt]').isVisible())await purchaser.locator('#navStock').click();await purchaser.locator('[data-inventory=receipt]').click();await purchaser.locator('#outletStockForm [name=reason]').fill('Keep this unsaved note');await purchaser.locator('#stockItemPicker [role=combobox]').fill('QA live');
 const state=await api(admin,'state');const original=state.items.find(i=>i.name==='QA priced item');
 await cmd(admin,'changes',{changes:[{entity:'items',key:'qa_live_item',value:{...original,id:'qa_live_item',name:'QA live item',thresholdEnabled:false}}]});
 await purchaser.locator('#stockItemPicker [role=option]').filter({hasText:'QA live item'}).waitFor({timeout:6500});assert.equal(await purchaser.locator('#outletStockForm [name=reason]').inputValue(),'Keep this unsaved note');
 const head=await browser.newPage(),executive=await browser.newPage();head.on('pageerror',e=>errors.push(e.message));executive.on('pageerror',e=>errors.push(e.message));await login(head,'qa_head');await login(executive,'qa_exec');
 const requirement={id:crypto.randomUUID(),itemId:original.id,itemName:original.name,outletId:'brigade',cuisine:'Indian',qty:2,status:'Pending'};
 const requested=await cmd(head,'changes',{changes:[{entity:'requests',key:requirement.id,value:requirement}]});
 const saved=requested.requests.find(r=>r.id===requirement.id),indent={id:crypto.randomUUID(),indentNumber:'REQ-QA-OPERATIONS',outletId:'brigade',outletName:'BRIGADE',status:'Pending Approval',items:[{itemId:original.id,itemName:original.name,unit:original.unit,originalQty:2,revisedQty:2}]};
 await cmd(executive,'changes',{changes:[{entity:'indents',key:indent.id,value:indent},{entity:'requests',key:saved.id,value:{...saved,status:'Consolidated',indentId:indent.id}}]});
 await purchaser.evaluate(()=>refreshDatabase());await purchaser.locator('[data-operations-nav][data-operations=approvals]').click();await purchaser.locator(`[data-action=approve-indent][data-id="${indent.id}"]`).click();await purchaser.locator(`[data-action=raise-po][data-id="${indent.id}"]`).waitFor();
 await purchaser.locator(`[data-action=raise-po][data-id="${indent.id}"]`).click();await purchaser.locator('#poItemsTableBody [data-po-item]').waitFor();await purchaser.locator('#btnConfirmSendPO').click();await purchaser.locator('#poVendorResults section').waitFor();await purchaser.locator('#poModalCancelBtn').click();
 if(!await purchaser.locator('[data-inventory=distribute]').isVisible())await purchaser.locator('#navStock').click();await purchaser.locator('[data-inventory=distribute]').click();await purchaser.locator('#stockItemPicker [role=combobox]').fill(original.name);await purchaser.locator('#stockItemPicker [role=option]').first().click();await purchaser.locator('#outletStockForm [name=cuisine]').selectOption('Indian');await purchaser.locator('#outletStockForm [name=quantity]').fill('2');await purchaser.locator('#outletStockForm .btn-primary').click();
 const issued=await api(purchaser,'state');const delivery=issued.operationRecords.find(r=>r.kind==='delivery' && r.requestId===saved.id);assert.ok(delivery);
 await head.evaluate(()=>refreshDatabase());await head.locator('[data-operations-nav][data-operations=deliveries]').click();await head.locator(`[data-action=confirm-delivery][data-id="${delivery.id}"]`).click();await head.locator('.operations-dialog [name=receivedQuantity]').fill('1');await head.locator('.operations-dialog [name=reason]').selectOption('Less quantity');await head.locator('.operations-dialog [name=affectedQuantity]').fill('1');await head.locator('.operations-dialog .btn-primary').click();await head.locator('.operations-dialog').waitFor({state:'detached'});
 await purchaser.evaluate(()=>refreshDatabase());await purchaser.locator('[data-operations-nav][data-operations=deliveries]').click();await purchaser.locator(`[data-action=resolve-delivery][data-id="${delivery.id}"]`).click();await purchaser.locator('.operations-dialog [name=resolution]').selectOption('shortage');await purchaser.locator('.operations-dialog [name=note]').fill('Confirmed missing at receipt');await purchaser.locator('.operations-dialog .btn-primary').click();await purchaser.locator('.operations-dialog').waitFor({state:'detached'});await head.close();await executive.close();
 // Bulk stock: downloads, full-file diagnostics, preview, and explicit all-row import.
 await purchaser.locator('#navStock').click();await purchaser.locator('[data-operations=legacy]').click();
 const templateEvent=purchaser.waitForEvent('download');await purchaser.locator('#legacyTemplate').click();const template=await templateEvent;assert.equal(template.suggestedFilename(),'nchef-legacy-stock-template.csv');
 const chunks=[];for await(const chunk of await template.createReadStream())chunks.push(chunk);assert.match(Buffer.concat(chunks).toString('utf8'),/Outlet.*Item.*Category.*Unit.*Quantity/);
 const {encodeCSV,importHeaders}=await import('../shared/legacy-import.mjs');
 const beforeImport=await api(purchaser,'state');
 const invalidCSV=encodeCSV([importHeaders,['brigade',original.name,'Wrong category',original.unit,'oops',''],['brigade',original.name,original.category,'Wrong unit',1,'']]);
 await purchaser.locator('#legacyFile').setInputFiles({name:'bad-stock.csv',mimeType:'text/csv',buffer:Buffer.from(invalidCSV)});await purchaser.locator('#legacyValidate').click();await purchaser.locator('#legacyErrors').waitFor();
 assert.match(await purchaser.locator('#legacyResults').innerText(),/Category/);assert.match(await purchaser.locator('#legacyResults').innerText(),/Quantity/);assert.match(await purchaser.locator('#legacyResults').innerText(),/Unit/);assert.equal((await api(purchaser,'state')).revision,beforeImport.revision);
 const errorEvent=purchaser.waitForEvent('download');await purchaser.locator('#legacyErrors').click();assert.equal((await errorEvent).suggestedFilename(),'nchef-legacy-stock-errors.csv');
 const validCSV=encodeCSV([importHeaders,['brigade',original.name,original.category,original.unit,.5,2.50]]);
 await purchaser.locator('#legacyFile').setInputFiles({name:'opening-stock.csv',mimeType:'text/csv',buffer:Buffer.from(validCSV)});await purchaser.locator('#legacyValidate').click();await purchaser.locator('#legacyConfirm').waitFor();assert.match(await purchaser.locator('#legacyResults').innerText(),/Stock after import/i);assert.equal((await api(purchaser,'state')).revision,beforeImport.revision);
 mkdirSync('screenshots/operations-qa',{recursive:true});await purchaser.screenshot({path:'screenshots/operations-qa/legacy-import-preview.png',fullPage:true});await purchaser.locator('#legacyConfirm').click();await purchaser.waitForFunction(()=>document.querySelector('#legacyStatus').textContent.includes('Imported all 1 rows successfully'));
 const afterImport=await api(purchaser,'state');assert.equal(afterImport.outletStock.find(b=>b.item_id===original.id && b.outlet_id==='brigade').quantity,beforeImport.outletStock.find(b=>b.item_id===original.id && b.outlet_id==='brigade').quantity+.5);
 await purchaser.locator('.sidebar-logo .logo-mark').click();await purchaser.locator('#viewOperations h1').filter({hasText:'Dashboard'}).waitFor();
 await purchaser.setViewportSize({width:390,height:844});await purchaser.reload();await purchaser.locator('#viewOperations h1').filter({hasText:'Dashboard'}).waitFor();await purchaser.locator('#page-loader').waitFor({state:'hidden'});
 assert.ok(await purchaser.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'Mobile dashboard fits viewport');
 mkdirSync('screenshots/operations-qa',{recursive:true});await purchaser.screenshot({path:'screenshots/operations-qa/purchaser-mobile.png',fullPage:true});
 await admin.locator('.sidebar-logo .logo-mark').click();await admin.screenshot({path:'screenshots/operations-qa/admin-desktop.png',fullPage:true});
 for(const username of ['qa_exec','qa_head']){const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await login(p,username);assert.equal(await p.locator('[data-operations-nav][data-operations=approvals]').isVisible(),false);await p.close();}
 assert.deepEqual(errors,[]);console.log('Operations browser QA passed: roles, dashboard, catalog, receipt pricing, invoice comparison, live refresh, approval, vendor ordering, delivery rejection/resolution, bulk CSV import/errors/downloads, and mobile layout.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
