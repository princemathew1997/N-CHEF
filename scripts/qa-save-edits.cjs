const assert=require('node:assert/strict');const {createRequire}=require('node:module');const {resolve}=require('node:path');
const {chromium}=createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT,'package.json'))('playwright');const base=process.env.NCHEF_QA_URL || 'http://127.0.0.1:8889';
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const admin=await browser.newPage(),exec=await browser.newPage();
 const login=async(page,username)=>{await page.goto(base);await page.locator('#username').fill(username);await page.locator('#password').fill('qa-only-password-2026');await page.locator('#loginBtn').click();await page.waitForFunction(()=>currentUser!==null);};
 const state=async page=>(await page.request.get(base+'/api/state')).json();
 const save=async changes=>{const response=await admin.request.post(base+'/api/changes',{headers:{Origin:base},data:{changes,revision:(await state(admin)).revision,operationId:crypto.randomUUID()}});assert.equal(response.status(),200,await response.text());return response.json();};
 await login(admin,'qa_admin');const outlet=crypto.randomUUID(),user=crypto.randomUUID(),username='save_'+Date.now();
 await save([{entity:'outlets',key:outlet,value:{id:outlet,name:'SAVE EDITS QA'}},{entity:'users',key:user,value:{id:user,username,name:'Save Edits QA',role:'executive_chef',assignedLocations:[outlet],password:'qa-only-password-2026'}}]);
 const item=(await state(admin)).items.find(i=>i.active!==false);const id=crypto.randomUUID();
 const req={id,itemId:item.id,itemName:item.name,outletId:outlet,cuisine:'Indian',qty:5,status:'Pending'};await save([{entity:'requests',key:id,value:req}]);
 await login(exec,username);await exec.evaluate(()=>switchToView('viewConsolidateRequests'));
 await exec.locator('[data-cuisine-qty]').fill('3');await exec.locator('[data-consolidation-note]').fill('Waiting for remaining cuisine orders');await exec.locator('#btnWsSaveEdits').click();await exec.locator('#wsSaveStatus').filter({hasText:'Edits saved'}).waitFor();
 let saved=await state(exec);assert.equal(saved.requests.find(r=>r.id===id).status,'Pending');assert.equal(saved.requests.find(r=>r.id===id).revisedQty,3);assert.equal(saved.indents.length,0);
 await exec.reload();await exec.waitForFunction(()=>currentUser!==null);await exec.evaluate(()=>switchToView('viewConsolidateRequests'));assert.equal(await exec.locator('[data-cuisine-qty]').inputValue(),'3');assert.equal(await exec.locator('[data-consolidation-note]').inputValue(),'Waiting for remaining cuisine orders');
 const additional={...req,id:crypto.randomUUID(),qty:2};await save([{entity:'requests',key:additional.id,value:additional}]);await exec.bringToFront();await exec.evaluate(()=>refreshDatabase());await exec.evaluate(()=>loadConsolidateWorkspace());assert.equal(await exec.locator('[data-cuisine-qty]').inputValue(),'5');assert.equal(await exec.locator('[data-consolidation-note]').inputValue(),'Waiting for remaining cuisine orders');
 await exec.locator('#btnWsSaveEdits').click();await exec.locator('#wsSaveStatus').filter({hasText:'Edits saved'}).waitFor();saved=await state(exec);assert.equal(saved.requests.find(r=>r.id===id).revisedQty,3);assert.equal(saved.requests.find(r=>r.id===additional.id).revisedQty,2);assert.equal(saved.indents.length,0);
 console.log('Save edits browser QA passed: persistence, unchanged workflow status, reload and combining new requests.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
