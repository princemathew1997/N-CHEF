import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('stock navigation restores permissions when roles change in the same browser',()=>{
    const elements=new Map();
    const element=(id,dataset={})=>{
        const classes=new Set();
        const value={dataset,textContent:'',classList:{add:c=>classes.add(c),toggle:(c,hide)=>hide?classes.add(c):classes.delete(c),contains:c=>classes.has(c)}};
        elements.set(id,value);return value;
    };
    const pages=['overview','receipt','distribute','adjust','history','catalog','assign','cuisines'];
    const links=pages.map(inventory=>element(inventory,{inventory}));
    for(const id of ['userTitle','navAddChef','navGroupRequests'])element(id);
    const context={window:{},InventoryTools:{day:()=>''},currentUser:{role:'executive_chef'},document:{addEventListener(){},getElementById:id=>elements.get(id),querySelectorAll:selector=>selector==='[data-inventory]'?links:[]}};
    runInNewContext(readFileSync('js/operations-ui.js','utf8'),context);
    for(const [role,view] of Object.entries({admin:'viewMasterOrders',executive_chef:'viewRequests',purchaser:'operations:approvals',cuisine_head:'viewChefPortal'}))assert.equal(context.window.homeViewForRole(role),view);
    context.window.configureOperationsRole();assert.equal(elements.get('receipt').classList.contains('hidden'),true);
    context.currentUser={role:'purchaser'};context.window.configureOperationsRole();
    assert.equal(elements.get('receipt').classList.contains('hidden'),false);
    assert.equal(elements.get('catalog').classList.contains('hidden'),true);
    context.currentUser={role:'admin'};context.window.configureOperationsRole();assert.equal(elements.get('catalog').classList.contains('hidden'),false);
    context.currentUser={role:'cuisine_head'};context.window.configureOperationsRole();assert.ok(links.every(a=>a.classList.contains('hidden')));
    let redirected;context.window.switchToView=view=>redirected=view;
    assert.equal(context.window.showOperationsView('operations:users'),true);assert.equal(redirected,'viewChefPortal');
    context.currentUser={role:'executive_chef'};assert.equal(context.window.showOperationsView('operations:vendor-orders'),true);assert.equal(redirected,'viewRequests');
});
