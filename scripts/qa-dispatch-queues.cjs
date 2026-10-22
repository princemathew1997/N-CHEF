// Requires qa-operations.cjs fixtures on the disposable port 8891 server.
const assert=require('node:assert/strict');
const openNavigation=require('./qa-nav.cjs');
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {mkdirSync}=require('node:fs');
const {chromium}=createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT,'package.json'))('playwright');
const base=process.env.NCHEF_QA_URL;
if(base!=='http://127.0.0.1:8891')throw Error('Use disposable port 8891 only.');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const errors=[];
  async function login(username){const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.goto(base);await page.locator('#username').fill(username);await page.locator('#password').fill('qa-only-password-2026');await page.locator('#loginBtn').click();await page.waitForFunction(()=>currentUser!==null);await page.locator('#page-loader').waitFor({state:'hidden'});return page;}
  const admin=await login('qa_admin'),head=await login('qa_head'),purchaser=await login('qa_purchaser'),executivePage=await login('qa_exec');
  const api=async(page,path,input)=>{const r=await page.request.fetch(base+'/api/'+path,{method:input?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json','X-NCHEF-Workspace':'paged'},data:input});const data=await r.json();assert.equal(r.status(),200,JSON.stringify(data));return data;};
  const cmd=async(page,path,input)=>api(page,path,{...input,revision:(await api(page,'state')).revision,operationId:crypto.randomUUID()});
  const state=await api(admin,'state'),recipient=state.users.find(u=>u.username==='qa_head'),executive=state.users.find(u=>u.username==='qa_exec');
  const items=state.items.filter(i=>i.active!==false).slice(0,2),date=await admin.evaluate(()=>InventoryTools.day());
  for(const item of items)await cmd(admin,'stock/opening',{outletId:'brigade',itemId:item.id,quantity:10,unitPrice:2});
  const requests=items.map(item=>({id:crypto.randomUUID(),itemId:item.id,itemName:item.name,unit:item.unit,outletId:'brigade',ownerId:recipient.id,cuisine:'Indian',qty:2,date,status:'Pending'}));
  const created=await cmd(head,'changes',{changes:requests.map(value=>({entity:'requests',key:value.id,value}))});
  requests.forEach(request=>Object.assign(request,created.requests.find(r=>r.id===request.id)));
  const orderReference='REQ-QUEUE-'+crypto.randomUUID().slice(0,8);
  const indent={id:crypto.randomUUID(),indentNumber:orderReference,outletId:'brigade',outletName:'BRIGADE',ownerId:executive.id,status:'Pending Approval',items:items.map(item=>({itemId:item.id,itemName:item.name,unit:item.unit,originalQty:2,revisedQty:2}))};
  await cmd(executivePage,'changes',{changes:[{entity:'indents',key:indent.id,value:indent},...requests.map(r=>({entity:'requests',key:r.id,value:{...r,indentId:indent.id,status:'Consolidated'}}))]});
  await cmd(admin,'indents/approve',{indentId:indent.id});
  for(let n=0;n<2;n++)await cmd(admin,'operations/distribution/issue',{indentId:indent.id,lines:requests.map(r=>({requestId:r.id,quantity:1,comment:'Split dispatch'}))});
  const groups=(await api(head,'dispatches?order='+orderReference)).rows;
  assert.equal(groups.length,2);assert.ok(groups.every(d=>d.itemCount===2 && d.awaiting===2));
  const first=groups[1],second=groups[0];
  await head.evaluate(()=>refreshDatabase());await head.locator('#navReceiveOrder').click();
  await head.locator('#operationsContent .queue-filter-panel summary').click();
  await head.locator('[name=order]').fill(orderReference);await head.locator('.queue-filters button[type=submit]').click();
  const card=id=>head.locator(`[data-dispatch="${id}"]`);
  await card(first.dispatchId).locator('[data-expand-dispatch]').click();
  const firstLine=(await api(head,'dispatches/items?dispatch='+encodeURIComponent(first.dispatchId))).rows[0];
  await head.locator(`[data-action=confirm-delivery][data-id="${firstLine.id}"]`).click();
  await head.locator('.operations-dialog [name=receivedQuantity]').fill('0');await head.locator('.operations-dialog [name=reason]').selectOption('Less quantity');await head.locator('.operations-dialog [name=affectedQuantity]').fill('1');await head.locator('.operations-dialog .btn-primary').click();await head.locator('.operations-dialog').waitFor({state:'detached'});
  await card(first.dispatchId).locator('[data-action=accept-dispatch]').click();await head.locator('#uiAlertOkBtn').click();
  await head.waitForFunction(id=>document.querySelector(`[data-dispatch="${id}"] .queue-issue`)?.textContent.includes('1 issue'),first.dispatchId);
  const after=await api(head,'dispatches/items?dispatch='+encodeURIComponent(first.dispatchId));assert.equal(after.rows.filter(d=>d.status==='Issue reported').length,1);assert.equal(after.rows.filter(d=>d.status==='Received').length,1);
  assert.ok((await api(head,'dispatches/items?dispatch='+encodeURIComponent(second.dispatchId))).rows.every(d=>d.status==='Issued'));
  mkdirSync('screenshots/dispatch-queues',{recursive:true});await head.screenshot({path:'screenshots/dispatch-queues/chef-desktop.png',fullPage:true});
  await head.setViewportSize({width:390,height:844});await head.waitForFunction(()=>document.getElementById('appSidebar').getBoundingClientRect().right<=1);assert.ok(await head.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await head.screenshot({path:'screenshots/dispatch-queues/chef-mobile.png',fullPage:true});
  await card(second.dispatchId).locator('[data-action=accept-dispatch]').click();await head.locator('#uiAlertOkBtn').click();await card(second.dispatchId).waitFor({state:'detached'});
  await head.locator('[data-queue-view=history]').click();await card(second.dispatchId).waitFor();assert.equal(await card(first.dispatchId).count(),0);
  await purchaser.evaluate(()=>refreshDatabase());await openNavigation(purchaser,'#navCuisineDeliveries');await purchaser.locator('[data-dispatch]').first().waitFor();assert.equal(await purchaser.locator('[data-dispatch]').first().getAttribute('data-dispatch'),first.dispatchId);
  await openNavigation(purchaser,'[data-inventory=history]');await purchaser.locator('[data-history-rows] tbody tr').first().waitFor();assert.equal(await purchaser.locator('#inventoryContent .queue-filters [name=from]').inputValue(),date);
  assert.equal((await api(head,'state')).stockHistory.length,0);assert.deepEqual(errors,[]);
  console.log('Dispatch browser QA passed: two dispatches from one order, per-item issues, card-only bulk acceptance, completed history, issue priority, IST history, and desktop/mobile layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
