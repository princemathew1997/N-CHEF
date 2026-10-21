const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {mkdirSync}=require('node:fs');
const {chromium}=createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT,'package.json'))('playwright');
const base=process.env.NCHEF_QA_URL;
if(!/^http:\/\/127\.0\.0\.1:889[01]$/.test(base))throw new Error('Use a disposable test preview on 8890 or 8891.');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const errors=[];
  async function login(username){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);await page.locator('#username').fill(username);await page.locator('#password').fill('qa-only-password-2026');await page.locator('#loginBtn').click();
   await page.waitForFunction(()=>currentUser!==null);await page.locator('#page-loader').waitFor({state:'hidden'});return page;
  }
  const purchaser=await login('qa_purchaser');
  await purchaser.evaluate(()=>switchToView('operations:purchases'));
  await purchaser.locator('[data-purchase-section=received]').click();
  const today=await purchaser.evaluate(()=>InventoryTools.day());
  assert.equal(await purchaser.locator('#purchaseFrom').inputValue(),today);assert.equal(await purchaser.locator('#purchaseTo').inputValue(),today);
  await purchaser.evaluate(()=>switchToView('inventory:receipt'));
  assert.equal(await purchaser.locator('#inventoryContent [data-operations=receipts]').count(),0);
  await purchaser.getByRole('button',{name:'Receive stock from Vendor Order',exact:true}).click();
  assert.equal(await purchaser.locator('#purchaseFrom').inputValue(),'');assert.equal(await purchaser.locator('#purchaseTo').inputValue(),'');
  assert.match(await purchaser.locator('[data-purchase-section=open]').getAttribute('class'),/btn-primary/);
  const receive=purchaser.locator('[data-action=receive-po]').first();
  assert.ok(await receive.count(),'Fixture has an outstanding vendor order');await receive.click();
  const form=purchaser.locator('.vendor-receipt-dialog form');
  await form.locator('[name^=cost_]').fill('10');await form.locator('[name=vendorInvoiceTotal]').fill('25');
  const values=await form.evaluate(f=>({total:f.querySelector('#vendorReceiveTotal').textContent,difference:f.querySelector('#vendorInvoiceDifference').textContent}));
  assert.match(values.total,/20\.00/);assert.match(values.difference,/5\.00/);
  mkdirSync('screenshots/completed-changes',{recursive:true});await purchaser.screenshot({path:'screenshots/completed-changes/vendor-invoice-desktop.png',fullPage:true});
  await purchaser.setViewportSize({width:390,height:844});
  assert.ok(await purchaser.locator('.vendor-receipt-dialog').evaluate(el=>el.getBoundingClientRect().width<=innerWidth));
  await purchaser.screenshot({path:'screenshots/completed-changes/vendor-invoice-mobile.png',fullPage:true});
  const head=await login('qa_head');
  assert.equal(await head.locator('#navGroupStock').isVisible(),false);assert.equal(await head.locator('#navReceiveOrder').isVisible(),true);
  await head.locator('#navReceiveOrder').click();assert.equal(await head.locator('#viewOperations h1').innerText(),'Receive Order');
  const executive=await login('qa_exec');
  assert.equal(await executive.locator('#filterOutlet').isVisible(),false);
  assert.equal(await executive.locator('#filterOutlet option').count(),1);
  await require('./qa-review-flow.cjs')(browser,base);
  assert.deepEqual(errors,[]);
  console.log('Completed-change browser checks passed: received date defaults, vendor-order shortcut, live invoice comparison, desktop/mobile dialog bounds, direct chef Receive Order, executive fixed outlet.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
