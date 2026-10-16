// Requires a fresh disposable scripts/qa-server.mjs instance. Never runs against production.
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {mkdirSync,writeFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const req=process.env.NCHEF_PLAYWRIGHT_ROOT?createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT,'package.json')):require;
const {chromium}=req('playwright');
const base='http://127.0.0.1:8888';
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,...(process.env.NCHEF_BROWSER_PATH?{executablePath:process.env.NCHEF_BROWSER_PATH}:{channel:'msedge'})});
 const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1.5,acceptDownloads:true});
 const failures=[];page.on('pageerror',error=>failures.push(error.message));
 const shot=async name=>{
   const selectors=name==='admin-purchase-order'?['.po-item-qty','.po-item-vendor','.po-item-note','#btnConfirmSendPO']:['#poVendorResults section [data-po-pdf]','#poVendorResults section [data-po-print]'];
   await page.evaluate(selectors=>selectors.forEach((s,i)=>{const r=document.querySelector(s).getBoundingClientRect();const b=document.createElement('span');b.className='vendor-guide-callout';b.textContent=i+1;b.style.cssText=`position:fixed;left:${r.x-12}px;top:${r.y-12}px;z-index:100000;border:2px solid white;border-radius:50%;width:26px;height:26px;display:grid;place-items:center;background:#ffbe0b;color:black;font:bold 15px Arial`;document.body.append(b);}),selectors);
   await page.locator('#modalVendorPO > .panel').screenshot({path:`docs/user-guides/images/${name}.png`});await page.evaluate(()=>document.querySelectorAll('.vendor-guide-callout').forEach(e=>e.remove()));
 };
 await page.goto(base);await page.locator('#username').fill('qa_admin');await page.locator('#password').fill('qa-only-password-2026');await page.locator('#loginBtn').click();
 await page.waitForFunction(()=>currentUser?.role==='admin');await page.locator('#page-loader').waitFor({state:'hidden'});
 const api=async(path,input)=>{const r=await page.request.fetch(base+'/api/'+path,{method:input?'POST':'GET',headers:{Origin:base},data:input});const data=await r.json();assert.equal(r.status(),200,JSON.stringify(data));return data;};
 const initial=await api('state');
 if(process.argv.includes('--refresh')){
   const saved=initial;
   for(const po of saved.purchase_orders){const download=page.waitForEvent('download');await page.evaluate(id=>VendorOrderUI.download(id),po.id);const result=await download;await result.saveAs(resolve('tmp/pdfs',result.suggestedFilename()));}
   await page.evaluate(id=>{switchToView('viewRequests');openIndentApprovalModal(id);openVendorPOModal();},saved.indents[0].id);await shot('admin-vendor-results');return;
 }
 assert.equal(initial.indents.length,0,'Start a fresh disposable QA database.');
 const vendors=[{id:crypto.randomUUID(),name:'Sample Supplier Alpha'},{id:crypto.randomUUID(),name:'Sample Supplier Beta'}];
 const items=['Sample Rice','Sample Oil','Sample Flour'].map((name,index)=>({id:crypto.randomUUID(),name,category:'Training',unit:index===1?'l':'kg',vendor:vendors[index===1?1:0].name,bought:0,allocations:{},consumed:{},active:true,cuisine:'Indian'}));
 const indent={id:crypto.randomUUID(),indentNumber:'REQ-SAMPLE-VENDORS',outletId:'brigade',outletName:'BRIGADE',status:'Pending Approval',items:items.map((i,index)=>({itemId:i.id,itemName:i.name,unit:i.unit,originalQty:index+2,revisedQty:index+2,comment:'Internal kitchen note - never send'}))};
 await api('changes',{operationId:crypto.randomUUID(),revision:initial.revision,changes:[...vendors.map(value=>({entity:'vendors',key:value.id,value})),...items.map(value=>({entity:'items',key:value.id,value})),{entity:'indents',key:indent.id,value:indent}]});
 await page.reload();await page.waitForFunction(()=>currentUser?.role==='admin');await page.locator('#page-loader').waitFor({state:'hidden'});
 await page.evaluate(id=>{switchToView('viewRequests');openIndentApprovalModal(id);openVendorPOModal();},indent.id);
 const rows=page.locator('#poItemsTableBody [data-po-item]');assert.equal(await rows.count(),3);
 assert.deepEqual(await rows.locator('.po-item-vendor').evaluateAll(es=>es.map(e=>e.value)),[vendors[0].id,vendors[1].id,vendors[0].id]);
 await rows.nth(2).locator('.po-item-vendor').selectOption(vendors[1].id);
 await rows.nth(0).locator('.po-item-note').fill('Alpha delivery note');await rows.nth(1).locator('.po-item-note').fill('Beta delivery note');
 // No supplier may be silently substituted when a preferred vendor is unavailable.
 await rows.nth(0).locator('.po-item-vendor').selectOption('');await page.locator('#btnConfirmSendPO').click();assert.equal((await api('state')).purchase_orders.length,0);await rows.nth(0).locator('.po-item-vendor').selectOption(vendors[0].id);
 mkdirSync('tmp/pdfs',{recursive:true});mkdirSync('docs/user-guides/images',{recursive:true});
 await shot('admin-purchase-order');
 await page.locator('#btnConfirmSendPO').click();await page.locator('#poVendorResults').waitFor({state:'visible'});
 assert.equal(await page.locator('#poVendorResults section').count(),2);
 const saved=await api('state');assert.equal(saved.purchase_orders.length,2);
 assert.equal(saved.items.find(i=>i.id===items[2].id).vendor,vendors[0].name,'Override must not alter preferred vendor');
 assert.equal(saved.stockHistory.length,initial.stockHistory.length);
 await shot('admin-vendor-results');
 for(const po of saved.purchase_orders) {
   const popup=page.waitForEvent('popup');await page.locator(`#poVendorResults [data-po-print="${po.id}"]`).click();const preview=await popup;await preview.waitForLoadState();
   const content=await preview.locator('body').innerText();assert.ok(content.includes(po.vendorName));
   assert.ok(!content.includes(vendors.find(v=>v.id!==po.vendorId).name));
   assert.ok(!content.includes('Internal kitchen note'));
   for(const other of saved.purchase_orders.filter(p=>p.id!==po.id))for(const item of other.items){assert.ok(!content.includes(item.itemName));if(item.notes)assert.ok(!content.includes(item.notes));}
   await preview.close();
   if(await page.evaluate(()=>typeof html2pdf!=='undefined')) {
     const download=page.waitForEvent('download');await page.locator(`#poVendorResults [data-po-pdf="${po.id}"]`).click();const result=await download;await result.saveAs(resolve('tmp/pdfs',result.suggestedFilename()));assert.equal(await result.failure(),null);
   } else throw Error('html2pdf unavailable: print fallback verified, direct download still needs verification.');
 }
 // Reopening shows existing orders and has no second save action.
 await page.evaluate(()=>{VendorOrderUI.open();});assert.equal(await page.locator('#btnConfirmSendPO').isVisible(),false);
 await page.locator('#closeVendorPOModalBtn').click();await page.evaluate(()=>{switchToView('viewVendors');});
 assert.equal(await page.locator('#vendorPOTableBody [data-po-pdf]').count(),2);
 assert.deepEqual(failures,[]);
 writeFileSync('tmp/pdfs/vendor-order-checks.json',JSON.stringify({defaults:true,override:true,missingVendorBlocked:true,separateOrders:true,isolatedDocuments:true,separatePDFDownloads:true,duplicateSavePrevented:true,catalogUnchanged:true,stockUnchanged:true},null,2));
 console.log('Vendor UI and separate PDF downloads verified; sample PDFs in tmp/pdfs.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>browser?.close());
