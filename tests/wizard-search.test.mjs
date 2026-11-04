import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
await import('../js/inventory-tools.js');

function setup(role) {
    const nodes=new Map(Object.entries({wizardItemSearch:{value:''},wizardSearchStatus:{textContent:''},wizardItemsGrid:{innerHTML:''},wizardRequestDate:{value:'2026-11-04'},wizardOutlet:{value:'a'},wizardCuisine:{value:'Indian'},wizardSelectedCount:{textContent:''}}));
    const context={window:{},document:{getElementById:id=>nodes.get(id),addEventListener(){}},setTimeout(){},InventoryTools:globalThis.InventoryTools,currentUser:{id:'chef',role},requestsData:[],masterItemsData:[{id:'rice',name:'Rice',category:'Dry',unit:'kg'},{id:'flour',name:'Rice flour',category:'Flour',unit:'kg'},{id:'inactive',name:'Rice retired',category:'Dry',unit:'kg',active:false},{id:'milk',name:'Milk',category:'Dairy',unit:'l'}]};
    runInNewContext(readFileSync('js/wizard.js','utf8'),context);
    runInNewContext("currentWizardCat='Dairy'",context);
    return {context,nodes,render:()=>context.window.renderWizardItems()};
}

for(const role of ['cuisine_head','executive_chef']) {
    test(`${role} searches across categories, preserves selection, and clears back to category`,()=>{
        const {context,nodes,render}=setup(role);
        render();assert.match(nodes.get('wizardItemsGrid').innerHTML,/Milk/);assert.doesNotMatch(nodes.get('wizardItemsGrid').innerHTML,/Rice/);
        nodes.get('wizardItemSearch').value='  rIcE  ';render();
        assert.match(nodes.get('wizardItemsGrid').innerHTML,/Rice flour/);assert.match(nodes.get('wizardSearchStatus').textContent,/2 matching/);
        assert.doesNotMatch(nodes.get('wizardItemsGrid').innerHTML,/Milk|Rice retired/);
        context.window.toggleWizardItem('flour');
        nodes.get('wizardItemSearch').value='milk';render();
        assert.equal(nodes.get('wizardSelectedCount').textContent,'(1)');
        nodes.get('wizardItemSearch').value='rice';render();
        assert.match(nodes.get('wizardItemsGrid').innerHTML,/Indian/);
        nodes.get('wizardItemSearch').value='missing';render();assert.match(nodes.get('wizardItemsGrid').innerHTML,/No matching ingredients/);
        nodes.get('wizardItemSearch').value='';render();assert.match(nodes.get('wizardItemsGrid').innerHTML,/Milk/);assert.equal(nodes.get('wizardSearchStatus').textContent,'');
    });
}

test('search results keep the existing-order duplicate protection',()=>{
    const {context,nodes,render}=setup('cuisine_head');
    context.requestsData.push({ownerId:'chef',outletId:'a',date:'2026-11-04',itemId:'rice'});
    nodes.get('wizardItemSearch').value='rice';render();
    assert.match(nodes.get('wizardItemsGrid').innerHTML,/Already ordered/);
    let warned=false;context.alert=()=>{warned=true;};context.window.toggleWizardItem('rice');
    assert.equal(warned,true);assert.equal(runInNewContext('Object.keys(wizardSelectedItems).length',context),0);
});
