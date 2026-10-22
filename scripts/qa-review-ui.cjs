// Additional browser regressions. Invoked by qa-operations.cjs against disposable QA data only.
const assert=require('node:assert/strict');
module.exports=async function reviewUI(admin,purchaser){
 await admin.locator('.sidebar-logo .logo-mark').click();
 assert.equal(await admin.locator('.nav-children .nav-children').count(),0,'Related actions have at most one level');
 assert.ok(await admin.locator('.nav-workgroup').count()>0,'Admin actions are compactly grouped');
 await admin.locator('#navOverview').click();
 await admin.locator('[data-inventory=history]').click();await admin.locator('#navOverview').click();
 assert.equal(await admin.locator('#viewInventory h1').innerText(),'Stock Overview');
 assert.equal(await admin.locator('#navOverviewSubmenu').count(),0);
 await admin.locator('#navCatalog').click();await admin.locator('[data-operations=category]').click();await admin.locator('#navCatalog').click();
 assert.equal(await admin.locator('#viewInventory h1').innerText(),'Item Catalog');
 assert.equal(await admin.locator('#navCatalogSubmenu').count(),0);
 assert.equal(await admin.locator('#catalogForm [name=thresholdEnabled]').getAttribute('role'),'switch');
 assert.equal(await admin.locator('#catalogForm [name=thresholdEnabled]').isChecked(),false);
 assert.equal(await admin.locator('#thresholdToggleStatus').innerText(),'Off');
 await admin.locator('#catalogForm [name=thresholdEnabled]').check();assert.equal(await admin.locator('#thresholdToggleStatus').innerText(),'On');
 assert.equal(await admin.locator('#navStockLinks [data-operations=deliveries]').count(),1);
 assert.equal(await admin.locator('#navStockLinks [data-inventory=assign]').count(),1);
 assert.equal(await admin.locator('#navStockLinks [data-operations=legacy]').count(),1);
 assert.equal(await admin.locator('#navStockLinks').evaluate(el=>el.lastElementChild.dataset.operations),'wastage');
 await admin.locator('#navUsers').click();
 const form=admin.locator('#operationsContent form');
 assert.equal(await form.locator('[name=password]').getAttribute('minlength'),'4');
 for(const role of ['executive_chef','purchaser','cuisine_head','admin']){
  await form.locator('[name=role]').selectOption(role);
  assert.equal(await form.locator('[data-user-assignment=outlets]').isVisible(),role!=='admin');
  assert.equal(await form.locator('[data-user-assignment=cuisines]').isVisible(),role==='cuisine_head');
 }
 await form.locator('[name=name]').fill('Pending unsaved user');
 await admin.locator('#userRoleFilter').selectOption('cuisine_head');
 assert.equal(await admin.locator('#userTableRows tbody tr').count(),1);
 assert.match(await admin.locator('#userTableRows').innerText(),/QA Cuisine Head/);
 await admin.locator('#userOutletFilter').selectOption('brigade');
 assert.match(await admin.locator('#userTableRows').innerText(),/QA Cuisine Head/);
 await admin.locator('#userOutletFilter').selectOption('cafe');
 assert.match(await admin.locator('#userTableRows').innerText(),/No records/);
 assert.equal(await form.locator('[name=name]').inputValue(),'Pending unsaved user','Filtering must preserve the user form');
 await admin.locator('#userFilterReset').click();assert.equal(await admin.locator('#userRoleFilter').inputValue(),'');assert.equal(await admin.locator('#userOutletFilter').inputValue(),'');
 await purchaser.locator('#navUsers').click();
 assert.equal(await purchaser.locator('#operationsContent form').count(),0);
 assert.equal(await purchaser.locator('#userOutletFilter option[value=cafe]').count(),0,'Unassigned outlets stay private');
 assert.equal(await purchaser.locator('#userRoleFilter option[value=admin]').count(),0);
};
