// Read-only screen sweep after qa-operations has prepared isolated fixtures.
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {chromium}=createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT,'package.json'))('playwright');
const openNavigation=require('./qa-nav.cjs');
const base=process.env.NCHEF_QA_URL;
assert.equal(base,'http://127.0.0.1:8891');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const errors=[],failures=[];let screens=0;
  for(const username of ['qa_admin','qa_purchaser','qa_exec','qa_head']){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   page.setDefaultTimeout(15000);let authenticated=false;
   page.on('pageerror',error=>errors.push(`${username}: ${error.message}`));
   page.on('response',response=>{if(authenticated && response.url().startsWith(base+'/api/') && response.status()>=400)failures.push(`${username}: ${response.status()} ${response.url()}`);});
   await page.goto(base);await page.locator('#username').fill(username);await page.locator('#password').fill('qa-only-password-2026');await page.locator('#loginBtn').click();
   await page.waitForFunction(()=>currentUser!==null);await page.locator('#page-loader').waitFor({state:'hidden'});authenticated=true;
   const selectors=new Set();
   const collect=async()=>{for(const selector of await page.locator('.nav-menu a:visible').evaluateAll(links=>links.map(link=>link.id?'#'+link.id:link.dataset.inventory?`[data-inventory="${link.dataset.inventory}"]`:`[data-operations-nav][data-operations="${link.dataset.operations}"]`)))selectors.add(selector);};
   await collect();
   for(const button of await page.locator('.nav-group-toggle').all()){if(await button.getAttribute('aria-expanded')==='false')await button.click();await collect();}
   for(const selector of selectors){
    await openNavigation(page,selector);
    await page.waitForFunction(()=>!document.querySelector('#page-loader') || getComputedStyle(document.querySelector('#page-loader')).display==='none');
    assert.ok((await page.locator('main').innerText()).trim().length>10,`${username} ${selector}: screen has content`);
    assert.equal(await page.locator('#uiAlertModal').isVisible(),false,`${username} ${selector}: no error dialog`);
    screens++;
   }
   await page.reload();await page.waitForFunction(()=>currentUser!==null);await page.locator('#page-loader').waitFor({state:'hidden'});
   authenticated=false;await page.locator('#logoutBtn').click();await page.locator('#loginBtn').waitFor({state:'visible'});
   const denied=await page.request.get(base+'/api/state');assert.equal(denied.status(),401);
   await page.close();
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(failures,[]);
  console.log(`Screen sweep passed: ${screens} role-visible destinations, reload, logout/session denial, no runtime errors or failed screen APIs.`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
