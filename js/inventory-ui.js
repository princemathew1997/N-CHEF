(() => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const allowed = () => !currentUser ? [] : outletsData.filter(o=>currentUser.role==='admin' || currentUser.assignedLocations?.includes('all') || currentUser.assignedLocations?.includes(o.id));
    const key = () => 'nchef_outlet_' + currentUser.id;
    let owner;
    function restore() {
        if (!currentUser) return '';
        const outlets=allowed();
        currentStoreView=InventoryTools.resolveOutlet(outlets,owner===currentUser.id?currentStoreView:localStorage.getItem(key()));
        owner=currentUser.id;
        if(currentStoreView)localStorage.setItem(key(),currentStoreView);
        return currentStoreView;
    }
    function choose(id) {
        currentStoreView=InventoryTools.resolveOutlet(allowed(),id);
        if(currentStoreView)localStorage.setItem(key(),currentStoreView);
        return currentStoreView;
    }
    function markup(name='outletId', all=false) {
        const rows=allowed();restore();
        if(rows.length===1)return `<input type="hidden" name="${name}" value="${esc(rows[0].id)}"><span class="fixed-outlet">${esc(rows[0].name)}</span>`;
        return `<select name="${name}" aria-label="Outlet">${all?'<option value="">All Outlets</option>':''}${rows.map(o=>`<option value="${esc(o.id)}" ${!all && o.id===currentStoreView?'selected':''}>${esc(o.name)}</option>`).join('')}</select>`;
    }
    function renderHeader() {
        restore();
        const trigger=document.getElementById('storeViewTrigger');const menu=document.getElementById('storeViewMenu');
        if(!trigger || !menu)return;
        const rows=allowed();trigger.disabled=rows.length<=1;
        document.getElementById('storeViewSelectedText').textContent=rows.find(o=>o.id===currentStoreView)?.name || 'No assigned outlet';
        document.getElementById('storeViewChevron').classList.toggle('hidden',rows.length<=1);
        menu.replaceChildren();
        rows.forEach(o=>{const button=document.createElement('button');button.type='button';button.className='outlet-menu-option';button.textContent=o.name;button.onclick=()=>{choose(o.id);menu.classList.add('hidden');loadDashboardData();};menu.append(button);});
        trigger.onclick=e=>{e.stopPropagation();if(rows.length>1)menu.classList.toggle('hidden');};
        if(!trigger.dataset.outletBound){document.addEventListener('click',e=>{if(!trigger.contains(e.target) && !menu.contains(e.target))menu.classList.add('hidden');});trigger.dataset.outletBound='true';}
    }
    window.OutletSelection={allowed,restore,choose,markup,renderHeader};
    document.addEventListener?.('change',event=>{
        const target=event.target;
        if (!target?.matches?.('[name="outletId"], [name="overviewOutlet"], [name="historyOutlet"], #wizardOutlet, #reqOutlet, #filterIndentsOutlet, #filterOutlet')) return;
        if (allowed().some(o=>o.id===target.value)) choose(target.value);
    });
    let sequence=0;
    window.createItemPicker = (container,items,{name='itemId',selected='',optional=false,onChange=()=>{}}={}) => {
        const id='item-picker-'+(++sequence);
        const initial=items.find(i=>i.id===selected);
        container.innerHTML=`<div class="item-picker"><input type="hidden" name="${esc(name)}" value="${esc(initial?.id || '')}"><input type="text" role="combobox" aria-label="Item name" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}" placeholder="${optional?'All items — type to search':'Type an item name to search'}" autocomplete="off" value="${esc(initial?.name || '')}" ${optional?'':'required'}><div class="item-picker-options hidden" id="${id}" role="listbox" aria-label="Matching items"></div></div>`;
        const hidden=container.querySelector('input[type=hidden]'),input=container.querySelector('input[type=text]'),list=container.querySelector('[role=listbox]');
        let matches=[],active=-1;
        const close=()=>{list.classList.add('hidden');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
        const valid=()=>input.setCustomValidity(hidden.value || (optional && !input.value.trim())?'':'Select an item from the search results.');
        function select(item){hidden.value=item.id;input.value=item.name;valid();close();onChange(item.id);}
        function draw(){
            const all=InventoryTools.matchItems(items,input.value);matches=all.slice(0,50);active=-1;
            list.replaceChildren();
            matches.forEach((item,index)=>{const option=document.createElement('button');option.type='button';option.role='option';option.id=id+'-'+index;option.className='item-picker-option';option.textContent=`${item.name} (${item.unit})`;option.onmousedown=e=>e.preventDefault();option.onclick=()=>select(item);list.append(option);});
            const message=document.createElement('small');message.textContent=all.length>50?`${all.length} matches. Type more to narrow the list.`:!all.length?'No matching items.':'';list.append(message);
            list.classList.remove('hidden');input.setAttribute('aria-expanded','true');
        }
        input.oninput=()=>{hidden.value='';valid();onChange('');draw();};input.onfocus=draw;
        input.onkeydown=e=>{
            if(e.key==='Escape'){close();return;}
            if(e.key==='ArrowDown' || e.key==='ArrowUp'){
                e.preventDefault();if(list.classList.contains('hidden'))draw();
                active=Math.max(0,Math.min(matches.length-1,active+(e.key==='ArrowDown'?1:-1)));
                list.querySelectorAll('[role=option]').forEach((o,i)=>{o.setAttribute('aria-selected',String(i===active));if(i===active){input.setAttribute('aria-activedescendant',o.id);o.scrollIntoView({block:'nearest'});}});
            }
            if(e.key==='Enter' && !list.classList.contains('hidden')){e.preventDefault();if(matches[active])select(matches[active]);}
        };
        input.onblur=()=>{close();valid();};valid();
        return {clear(){hidden.value='';input.value='';valid();onChange('');},get value(){return hidden.value;}};
    };
})();
