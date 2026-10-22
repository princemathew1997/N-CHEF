// Keep related admin/purchaser actions one level deep; every main link is a real page.
(() => {
    let placements;
    function setOpen(group,open){
        group.querySelector('.nav-children').classList.toggle('open',open);
        group.querySelector('.nav-group-toggle').setAttribute('aria-expanded',String(open));
    }
    function closeOthers(selected){document.querySelectorAll('.nav-workgroup').forEach(group=>{if(group!==selected)setOpen(group,false);});}
    function updateBadges(){
        document.querySelectorAll('.nav-workgroup').forEach(group=>{
            const primary=group.querySelector(':scope > .nav-item'),native=primary.querySelector('.nav-attention-count');
            const related=[...group.querySelectorAll('.nav-children .nav-attention-count')].reduce((total,badge)=>total+(Number(badge.textContent) || 0),0);
            let summary=primary.querySelector('.nav-group-count');
            if(native)native.style.display=related?'none':'';
            if(!related){summary?.remove();return;}
            if(!summary){summary=document.createElement('span');summary.className='nav-group-count';primary.append(summary);}
            summary.textContent=related+(Number(native?.textContent) || 0);summary.setAttribute('aria-label',summary.textContent+' pending actions');
        });
    }
    function sync(){
        const selected=document.querySelector('.nav-workgroup .nav-item.active,.nav-workgroup .nav-subitem.active')?.closest('.nav-workgroup');
        closeOthers(selected);if(selected)setOpen(selected,true);updateBadges();
    }
    function configure(){
        const nav=document.querySelector('.nav-menu');if(!nav)return;
        if(!placements)placements=[...nav.querySelectorAll('a')].map(link=>{
            const marker=document.createComment('navigation destination');link.before(marker);
            if(!link.dataset.groupNavigationBound){link.addEventListener('click',()=>{const group=link.closest('.nav-workgroup');closeOthers(group);if(group)setOpen(group,true);});link.dataset.groupNavigationBound='true';}
            return {link,marker};
        });
        placements.forEach(({link,marker})=>{marker.after(link);link.classList.remove('nav-subitem');link.classList.add('nav-item');link.querySelector('.nav-group-count')?.remove();const badge=link.querySelector('.nav-attention-count');if(badge)badge.style.display='';});
        nav.querySelectorAll('.nav-workgroup').forEach(group=>group.remove());
        if(!['admin','purchaser'].includes(currentUser?.role))return;
        const lookup=selector=>nav.querySelector(selector);
        const visible=link=>link && !link.classList.contains('hidden') && !link.closest('.hidden');
        function group(primarySelector,childSelectors){
            const primary=lookup(primarySelector),children=childSelectors.map(lookup).filter(visible);
            if(!visible(primary) || !children.length)return;
            const wrapper=document.createElement('div');wrapper.className='nav-workgroup';primary.before(wrapper);wrapper.append(primary);
            const toggle=document.createElement('button');toggle.type='button';toggle.className='nav-group-toggle';
            const label=primary.textContent.trim();toggle.setAttribute('aria-label','Show related '+label+' actions');toggle.setAttribute('aria-expanded','false');toggle.textContent='⌄';
            const submenu=document.createElement('div');submenu.className='nav-children';submenu.id='related-'+(primary.id || primary.dataset.inventory || primary.dataset.operations);toggle.setAttribute('aria-controls',submenu.id);
            children.forEach(child=>{child.classList.remove('nav-item');child.classList.add('nav-subitem');submenu.append(child);});wrapper.append(toggle,submenu);
            toggle.onclick=()=>{const open=!submenu.classList.contains('open');closeOthers(wrapper);setOpen(wrapper,open);};
        }
        group('#navOverview',['[data-inventory=receipt]','[data-inventory=adjust]','[data-inventory=history]']);
        group('[data-inventory=distribute]',['#navCuisineDeliveries']);
        group('[data-inventory=assign]',['[data-operations=legacy]']);
        group('[data-operations=approvals]',['[data-operations=vendor-orders]','#navManageRequests']);
        group('#navCatalog',['[data-operations=category]','[data-operations=unit]','[data-inventory=cuisines]']);
        group('#navUsers',['[data-operations=accounts]']);
        sync();
    }
    window.NavigationGroups={configure,sync,updateBadges};
})();
