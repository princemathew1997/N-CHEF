import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync('js/app.js','utf8');
const operations=readFileSync('js/operations-ui.js','utf8');
function element(){
    const classes=new Set();
    return {hidden:false,disabled:false,style:{},dataset:{},attributes:{},textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c);}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}};
}

test('sidebar opens the selected nested group and closes its siblings',()=>{
    const ids=new Map();
    for(const name of ['Stock','Requests','Catalog','Distribution','Legacy','Overview'])for(const suffix of ['','Submenu','Chevron'])ids.set('nav'+name+suffix,element());
    const context={window:{},document:{getElementById:id=>ids.get(id),querySelectorAll:()=>[...ids].filter(([id])=>id.endsWith('Submenu')).map(([,el])=>el)}};
    runInNewContext(app.slice(app.indexOf('window.collapseSidebarGroups ='),app.indexOf('window.switchToView =')),context);
    context.window.expandSidebarGroup('Overview');
    assert.ok(ids.get('navStockSubmenu').classList.contains('open'));
    assert.ok(ids.get('navOverviewSubmenu').classList.contains('open'));
    context.window.expandSidebarGroup('Legacy');
    assert.ok(!ids.get('navOverviewSubmenu').classList.contains('open'));
    assert.equal(ids.get('navOverview').attributes['aria-expanded'],'false');
    assert.ok(ids.get('navLegacySubmenu').classList.contains('open'));
    context.window.expandSidebarGroup('Catalog');
    assert.ok(!ids.get('navStockSubmenu').classList.contains('open'));
    assert.ok(ids.get('navCatalogSubmenu').classList.contains('open'));
    context.window.collapseSidebarGroups();
    assert.ok([...ids].filter(([id])=>id.endsWith('Submenu')).every(([,el])=>!el.classList.contains('open')));
});

test('user role switches show only relevant assignments and preserve selections',()=>{
    const role={value:'admin',addEventListener(type,fn){this.change=fn;}};
    const outlets=element(),cuisines=element();outlets.dataset.userAssignment='outlets';cuisines.dataset.userAssignment='cuisines';
    const form={querySelector:s=>s==='select[name=role]'?role:outlets,querySelectorAll:()=>[outlets,cuisines]};
    const context={form};
    runInNewContext(operations.slice(operations.indexOf('    function configureUserAssignments'),operations.indexOf('    function userForm'))+'configureUserAssignments(form);',context);
    assert.ok(outlets.hidden && cuisines.hidden);
    for(const selected of ['executive_chef','purchaser']){role.value=selected;role.change();assert.equal(outlets.hidden,false);assert.equal(cuisines.hidden,true);assert.equal(cuisines.disabled,true);}
    role.value='cuisine_head';role.change();assert.equal(outlets.hidden,false);assert.equal(cuisines.hidden,false);assert.equal(cuisines.disabled,false);
});

test('saving a non-cuisine role clears irrelevant cuisine assignments',()=>{
    const checked={value:'Indian'};
    const context={crypto:{randomUUID:()=> 'new_user'},names:{purchaser:'Purchaser'},form:{querySelectorAll:s=>s.includes('cuisine')?[checked]:[{value:'a'}]},data:{name:'Person',username:'person',role:'purchaser'},result:null};
    runInNewContext(operations.slice(operations.indexOf('    function readUser('),operations.indexOf('    function editorForm('))+'result=readUser(data,form);',context);
    assert.equal(context.result.assignedSections.length,0);
    assert.deepEqual(Array.from(context.result.assignedLocations),['a']);
});

test('sending edited cuisine quantities focuses missing notes without a modal or write',async()=>{
    const note=element();note.dataset.consolidationNote='rice';let focused=false,scrolled=false;
    note.focus=()=>focused=true;note.scrollIntoView=()=>scrolled=true;
    const context={window:{},indentsData:[],document:{querySelector:()=>null,querySelectorAll:()=>[note]},activeWorkspaceConsolidation:{groupedItems:{rice:{itemId:'rice',comment:'   ',originalQty:10,chefRequests:[{qty:5,revisedQty:4},{qty:5,revisedQty:6}]}}}};
    runInNewContext(app.slice(app.indexOf('window.submitWorkspaceConsolidatedIndent ='),app.indexOf('    // Count how many items have adjustments or notes',app.indexOf('window.submitWorkspaceConsolidatedIndent =')))+'};',context);
    await context.window.submitWorkspaceConsolidatedIndent();
    assert.ok(focused && scrolled);assert.ok(note.classList.contains('missing-note'));assert.equal(note.attributes['aria-invalid'],'true');
});

test('request attention highlights the menu and tab, and deduplicates overlays',()=>{
    const nodes=new Map(['pendingRequestsBadge','navRequests'].map(id=>[id,element()]));let overlays=0;
    const context={window:{},currentUser:{id:'exec',role:'executive_chef'},requestsData:[{id:'r1',status:'Pending'}],indentsData:[],committedState:{operationRecords:[]},setTimeout:()=>1,clearTimeout(){},document:{title:'N-CHEF',querySelector:()=>null,getElementById:id=>nodes.get(id),createElement(){const el=element();el.replaceChildren=()=>{};el.append=()=>{};return el;},body:{append(el){overlays++;nodes.set(el.id,el);}}}};
    runInNewContext(app.slice(app.indexOf('function getVisibleNotifications()'),app.indexOf('function updateIndentsBadge()')),context);
    context.updateRequestsBadge();assert.ok(nodes.get('navRequests').classList.contains('has-pending-requests'));assert.equal(context.document.title,'(1) N-CHEF');assert.equal(overlays,0,'Existing requests do not trigger a new popup on login');
    context.requestsData.push({id:'r2',status:'Pending'});context.updateRequestsBadge();assert.equal(overlays,1);
    nodes.get('requestNoticeOverlay').hidden=true;context.updateRequestsBadge();assert.equal(nodes.get('requestNoticeOverlay').hidden,true);
    context.requestsData=[{id:'r1',status:'Accepted'}];context.updateRequestsBadge();assert.equal(nodes.get('pendingRequestsBadge').classList.contains('hidden'),true);assert.equal(nodes.get('requestNoticeOverlay').hidden,true);
    context.requestsData=[];context.updateRequestsBadge();assert.equal(context.document.title,'N-CHEF');assert.ok(!nodes.get('navRequests').classList.contains('has-pending-requests'));
});

test('login counts only real user notifications and does not announce existing alerts as new',()=>{
 const menu=element();const nodes=new Map([['navRequests',element()],['pendingRequestsBadge',element()]]);
 const context={window:{},currentUser:{id:'a',role:'admin'},requestsData:[],indentsData:[],committedState:{operationRecords:[{id:'old',kind:'notification',userId:'a',message:'Existing alert',read:false},{id:'internal',kind:'notification',system:true},{id:'other',kind:'notification',userId:'b',message:'Private alert',read:false}]},setTimeout:()=>1,clearTimeout(){},document:{title:'N-CHEF',querySelector:()=>menu,getElementById:id=>nodes.get(id),createElement(){const el=element();el.replaceChildren=()=>{};el.append=()=>{};return el;},body:{append(el){nodes.set(el.id,el);}}}};
 runInNewContext(app.slice(app.indexOf('function getVisibleNotifications()'),app.indexOf('function updateIndentsBadge()')),context);
 context.updateRequestsBadge();assert.equal(menu.textContent,'Notifications (1)');assert.equal(context.document.title,'(1) N-CHEF');assert.equal(nodes.has('requestNoticeOverlay'),false);
 context.committedState.operationRecords[0].read=true;context.updateRequestsBadge();assert.equal(menu.textContent,'Notifications');assert.equal(context.document.title,'N-CHEF');
 context.committedState.operationRecords.push({id:'new',kind:'notification',userId:'a',message:'New alert',read:false});context.updateRequestsBadge();assert.equal(nodes.get('requestNoticeOverlay').hidden,false);
 context.committedState.operationRecords.at(-1).read=true;context.updateRequestsBadge();assert.equal(nodes.get('requestNoticeOverlay').hidden,true);
});
