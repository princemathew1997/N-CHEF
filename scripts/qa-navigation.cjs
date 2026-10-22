const assert=require('node:assert/strict');
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
  for(const username of ['qa_admin','qa_purchaser','qa_exec','qa_head']){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base);await page.locator('#username').fill(username);await page.locator('#password').fill('qa-only-password-2026');await page.locator('#loginBtn').click();await page.waitForFunction(()=>currentUser!==null);await page.locator('#page-loader').waitFor({state:'hidden'});
   assert.equal(await page.locator('.nav-children .nav-children').count(),0);
   assert.equal(await page.locator('.nav-menu a').evaluateAll(links=>links.every(link=>Boolean(link.querySelector('svg[data-lucide]')))),true,'Every navigation action keeps its icon');
   await page.evaluate(()=>updateRequestsBadge());assert.equal(await page.locator('[data-operations=notifications] svg[data-lucide=bell]').count(),1,'Notification refresh preserves its bell');
   if(['qa_admin','qa_purchaser'].includes(username)){
    assert.ok(await page.locator('.nav-workgroup').count()>=4);
    await page.locator('.sidebar-logo .logo-mark').click();
    if(username==='qa_admin')assert.ok(await page.locator('.nav-menu a:visible').count()<=15,'Admin has a compact set of main links');
    const group=page.locator('.nav-workgroup').filter({has:page.locator('#navOverview')});
    const before=await page.evaluate(()=>currentView);await group.locator('.nav-group-toggle').click();assert.equal(await page.evaluate(()=>currentView),before,'Arrow expands without navigating');
    await group.locator('.nav-group-toggle').focus();await page.keyboard.press('Enter');assert.equal(await group.locator('.nav-group-toggle').getAttribute('aria-expanded'),'false');
    await page.locator('#navOverview').click();assert.equal(await page.locator('#viewInventory h1').innerText(),'Stock Overview');assert.equal(await page.locator('[data-inventory=receipt]').isVisible(),true);
    if(username==='qa_admin'){
     await page.locator('.sidebar-logo .logo-mark').click();await page.mouse.move(900,100);
     mkdirSync('screenshots/navigation',{recursive:true});await page.screenshot({path:'screenshots/navigation/admin-desktop.png',fullPage:true});
     await page.setViewportSize({width:390,height:844});await page.locator('#mobileMenuBtn').click();await page.screenshot({path:'screenshots/navigation/admin-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    }
   }else{
    assert.equal(await page.locator('.nav-workgroup').count(),0,'Small role menus stay direct');
    if(username==='qa_head'){assert.equal(await page.locator('#navReceiveOrder').isVisible(),true);assert.equal(await page.locator('#navGroupStock').isVisible(),false);}
    else{assert.equal(await page.locator('#navIndents').isVisible(),false);assert.equal(await page.locator('#navCuisineDeliveries').isVisible(),true);}
   }
   await page.close();
  }
  assert.deepEqual(errors,[]);console.log('Navigation browser QA passed: compact admin/purchaser groups, real primary destinations, independent keyboard-accessible arrows, one level only, direct chef/executive menus and mobile layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
