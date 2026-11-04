// Run only against a disposable local qa-server.
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {mkdirSync}=require('node:fs');
const assert=require('node:assert/strict');
const req=createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT,'package.json'));
const {chromium}=req('playwright');
const openNavigation=require('./qa-nav.cjs');
const base=process.env.NCHEF_QA_URL || 'http://127.0.0.1:8891';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Disposable local QA server required.');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#username').fill('qa_admin');await page.locator('#password').fill('qa-only-password-2026');await page.locator('#loginBtn').click();
  await page.waitForFunction(()=>currentUser?.role==='admin');await page.locator('#page-loader').waitFor({state:'hidden'});
  const {itemId,expectedCount}=await page.evaluate(async()=>{
   const item=masterItemsData.find(i=>i.active!==false),vendor=vendorsData[0].name;
   const before=(await apiRequest('prices')).items.find(i=>i.id===item.id).receiptCount;
   for(let i=0;i<27;i++)await runDatabaseAction('stock/receipt',{outletId:'brigade',itemId:item.id,quantity:i%2+1,vendor,unitPrice:i===0?0:10+i});
   return {itemId:item.id,expectedCount:before+27};
  });
  await openNavigation(page,'[data-inventory=prices]');
  await page.locator('[data-price-item]').first().waitFor();
  assert.ok(await page.locator('[data-price-results]').textContent().then(t=>t.includes('No purchases in this period.')));
  await page.locator(`[data-price-item="${itemId}"]`).click();await page.locator('svg[aria-label="Daily purchase prices by outlet and vendor"]').waitFor();
  assert.equal(await page.locator('[data-price-results] tbody tr').count(),25);
  while(await page.getByRole('button',{name:'Load more receipts'}).count()) {
   const count=await page.locator('[data-price-results] tbody tr').count();
   await page.getByRole('button',{name:'Load more receipts'}).click();
   await page.waitForFunction(n=>document.querySelectorAll('[data-price-results] tbody tr').length>n,count);
  }
  assert.equal(await page.locator('[data-price-results] tbody tr').count(),expectedCount);
  assert.equal(await page.locator('[data-price-results] svg circle').count(),1);
  mkdirSync('tmp/price-history-qa',{recursive:true});
  await page.evaluate(()=>document.querySelector('.main-content').scrollTop=0);
  await page.screenshot({path:'tmp/price-history-qa/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  if(await page.locator('#appSidebar.mobile-open').count())await page.locator('#mobileDrawerCloseBtn').click();
  await page.evaluate(()=>document.querySelector('.main-content').scrollTop=0);
  await page.screenshot({path:'tmp/price-history-qa/mobile.png',fullPage:true,animations:'disabled'});
  assert.ok(await page.locator('[data-price-results] svg').isVisible());
  await page.locator('[data-price-back]').click();await page.locator('[data-price-item]').first().waitFor();
  await page.locator('#inventoryContent [name=from]').fill('2020-01-01');await page.locator('#inventoryContent [name=to]').fill('2020-01-02');
  await page.locator('#inventoryContent form button').click();await page.waitForFunction(()=>document.querySelector('[data-price-results]')?.textContent.includes('No purchases in this period.'));
  let failNext=true;
  await page.route('**/api/prices?**',route=>{if(failNext){failNext=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA temporary failure'})});}return route.continue();});
  await page.locator('#inventoryContent form button').click();await page.getByRole('alert').waitFor();
  await page.locator('[data-price-retry]').click();await page.locator('[data-price-item]').first().waitFor();
  assert.deepEqual(errors,[]);
  console.log('Price History desktop/mobile, receipt paging, chart, filters, empty state and retry verified.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
