// ============================================================
// REQUEST WIZARD LOGIC
// ============================================================
let wizardSelectedItems = {};
let currentWizardCat = '';
let allCategories = [];

function initRequestWizard() {
    const modal = document.getElementById('requestWizardModal');
    if (!modal) return;
    
    function openRequestWizard() {
        wizardSelectedItems = {};
        allCategories = [...new Set(masterItemsData.map(i => i.category))];
        if (allCategories.length > 0) {
            currentWizardCat = allCategories[0];
            renderWizardCategories();
            renderWizardItems();
        }
        
        const outletSelect = document.getElementById('wizardOutlet');
        const wizardOutletDisplay = document.getElementById('wizardOutletDisplay');
        if (outletSelect) {
            const vis = (typeof getVisibleOutlets === 'function') ? getVisibleOutlets() : outletsData;
            const isChef = currentUser && currentUser.role === 'chef';
            const isSingle = vis.length === 1;
            
            if (isChef || isSingle) {
                // For chef or single outlet user: NO dropdown, just mention the name of the allocated outlet
                let allocatedOutlet = null;
                if (isChef && currentUser.assignedLocations && !currentUser.assignedLocations.includes('all')) {
                    allocatedOutlet = outletsData.find(o => currentUser.assignedLocations.includes(o.id));
                }
                if (!allocatedOutlet) {
                    allocatedOutlet = vis[0] || outletsData[0] || { id: 'brigade', name: 'BRIGADE' };
                }
                
                outletSelect.innerHTML = `<option value="${allocatedOutlet.id}" selected>${allocatedOutlet.name}</option>`;
                outletSelect.value = allocatedOutlet.id;
                outletSelect.style.display = 'none';
                
                if (wizardOutletDisplay) {
                    wizardOutletDisplay.textContent = allocatedOutlet.name;
                    wizardOutletDisplay.style.display = 'inline-block';
                }
            } else {
                outletSelect.style.display = '';
                if (wizardOutletDisplay) wizardOutletDisplay.style.display = 'none';
                outletSelect.innerHTML = vis.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
            }
        }
        
        // Cuisine setup: Chef only sees their assigned cuisine(s)
        const cuisineSelect = document.getElementById('wizardCuisine');
        const wizardCuisineDisplay = document.getElementById('wizardCuisineDisplay');
        if (cuisineSelect) {
            const isChef = currentUser && currentUser.role === 'chef';
            let chefCuisines = [];
            if (isChef) {
                const assigned = currentUser.assignedSections || currentUser.assignedCuisines;
                if (Array.isArray(assigned)) {
                    chefCuisines = assigned.filter(Boolean);
                } else if (typeof assigned === 'string' && assigned.trim()) {
                    chefCuisines = assigned.split(',').map(s => s.trim());
                }
            }
            
            if (isChef && chefCuisines.length === 1) {
                // Exactly 1 cuisine assigned: NO dropdown, just display that cuisine
                const singleCuisine = chefCuisines[0];
                cuisineSelect.innerHTML = `<option value="${singleCuisine}" selected>${singleCuisine}</option>`;
                cuisineSelect.value = singleCuisine;
                cuisineSelect.style.display = 'none';
                if (wizardCuisineDisplay) {
                    wizardCuisineDisplay.textContent = singleCuisine;
                    wizardCuisineDisplay.style.display = 'inline-block';
                }
            } else if (isChef && chefCuisines.length > 1) {
                // Multiple cuisines assigned: dropdown with ONLY those assigned cuisines
                cuisineSelect.style.display = '';
                if (wizardCuisineDisplay) wizardCuisineDisplay.style.display = 'none';
                cuisineSelect.innerHTML = chefCuisines.map(c => `<option value="${c}">${c}</option>`).join('');
                cuisineSelect.value = chefCuisines[0];
            } else {
                // Admin, supervisor, or chef with no specific cuisine: show all cuisines
                cuisineSelect.style.display = '';
                if (wizardCuisineDisplay) wizardCuisineDisplay.style.display = 'none';
                const allCuisines = (typeof cuisinesData !== 'undefined' && cuisinesData.length > 0)
                    ? cuisinesData.map(c => c.name)
                    : ['Indian', 'Continental', 'Tandoor', 'Chinese', 'Arabic', 'Kerala'];
                cuisineSelect.innerHTML = allCuisines.map(c => `<option value="${c}">${c}</option>`).join('');
                if (allCuisines.length > 0) cuisineSelect.value = allCuisines[0];
            }
        }
        
        document.getElementById('wizardStep1').classList.remove('hidden');
        document.getElementById('wizardStep2').classList.add('hidden');
        document.getElementById('wizardSelectedCount').textContent = '(0)';
        modal.classList.remove('hidden');
    }
    window.openRequestWizard = openRequestWizard;

    // Sidebar button setup
    const sidebarBtn = document.getElementById('navSidebarRaiseRequest');
    if (sidebarBtn) {
        sidebarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openRequestWizard();
        });
    }

    window.updateChefRaiseRequestBtn = function() {
        const btn = document.getElementById('navSidebarRaiseRequest');
        if (!btn) return;
        // Chef uses the single primary action button directly on the Chef Portal view.
        // Hide sidebar duplicate to keep sidebar clean.
        if (currentUser && currentUser.role === 'chef') {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'none';
        }
    };
    
    document.getElementById('closeRequestWizardBtn')?.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    document.getElementById('wizardNextCatBtn')?.addEventListener('click', () => {
        const idx = allCategories.indexOf(currentWizardCat);
        if (idx < allCategories.length - 1) {
            currentWizardCat = allCategories[idx + 1];
        } else if (allCategories.length > 0) {
            currentWizardCat = allCategories[0];
        }
        renderWizardCategories();
        renderWizardItems();
    });

    document.getElementById('wizardReviewBtn')?.addEventListener('click', () => {
        if (Object.keys(wizardSelectedItems).length === 0) {
            alert('Please select at least one item to request.');
            return;
        }
        document.getElementById('wizardStep1').classList.add('hidden');
        document.getElementById('wizardStep2').classList.remove('hidden');
        renderWizardReview();
    });

    document.getElementById('wizardBackBtn')?.addEventListener('click', () => {
        document.getElementById('wizardStep2').classList.add('hidden');
        document.getElementById('wizardStep1').classList.remove('hidden');
    });

    document.getElementById('wizardSubmitBtn')?.addEventListener('click', () => {
        const items = [];
        for (const itemId in wizardSelectedItems) {
            const qtyInput = document.getElementById('wizardQty_' + itemId);
            const qty = parseFloat(qtyInput?.value) || 0;
            if (qty > 0) {
                items.push({ itemId, qty });
            }
        }
        
        if (items.length === 0) {
            alert('Please enter a quantity for at least one item.');
            return;
        }

        const cuisine = document.getElementById('wizardCuisine')?.value || 'Tandoor';
        let outletId = document.getElementById('wizardOutlet')?.value;
        if (currentUser && currentUser.role === 'chef') {
            let allocatedOutlet = null;
            if (currentUser.assignedLocations && !currentUser.assignedLocations.includes('all')) {
                allocatedOutlet = outletsData.find(o => currentUser.assignedLocations.includes(o.id));
            }
            if (allocatedOutlet) {
                outletId = allocatedOutlet.id;
            }
        }
        if (!outletId && typeof getVisibleOutlets === 'function') {
            const vis = getVisibleOutlets();
            outletId = vis.length > 0 ? vis[0].id : (outletsData[0]?.id || 'brigade');
        }
        const targetOutlet = outletsData.find(o => o.id === outletId) || outletsData[0] || { id: 'brigade', name: 'BRIGADE' };
        outletId = targetOutlet.id;
        const outletName = targetOutlet.name;

        const now = new Date().toISOString();
        const dateStr = now.split('T')[0];
        const chefName = (currentUser && currentUser.name) ? currentUser.name : 'Chef Prince';

        for (const it of items) {
            const masterItem = masterItemsData.find(i => i.id === it.itemId);
            requestsData.unshift({
                id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                itemId: it.itemId,
                itemName: masterItem?.name || 'Item',
                unit: masterItem?.unit || 'kg',
                outletId: outletId,
                outletName: outletName,
                qty: it.qty,
                cuisine: cuisine,
                chefName: chefName,
                requestedBy: chefName,
                status: 'Pending',
                timestamp: now,
                date: dateStr
            });
        }

        saveData();
        modal.classList.add('hidden');
        alert('Ingredient requests submitted successfully to supervisor!');
        if (typeof updateRequestsBadge === 'function') updateRequestsBadge();
        if (typeof updateIndentsBadge === 'function') updateIndentsBadge();
        if (typeof loadRequestsData === 'function') loadRequestsData();
        if (typeof loadChefPortalData === 'function') loadChefPortalData();
    });
    
    // Periodically ensure the button is there (simple robust way to survive view switches)
    setInterval(window.updateChefRaiseRequestBtn, 1000);
}

function renderWizardCategories() {
    const tabs = document.getElementById('wizardCategoryTabs');
    if(!tabs) return;
    tabs.innerHTML = allCategories.map(cat => {
        const isActive = cat === currentWizardCat;
        return `<button class="btn ${isActive ? 'btn-primary' : ''}" 
            style="white-space:nowrap; padding: 8px 18px; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.2s; ${isActive ? 'background: var(--primary); color: #000; box-shadow: 0 0 12px rgba(255,190,11,0.35); border: none;' : 'background: rgba(255,255,255,0.08); color: #ffffff; border: 1px solid rgba(255,255,255,0.3);'}" 
            onclick="currentWizardCat='${cat}'; renderWizardCategories(); renderWizardItems();">${cat}</button>`;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
}

window.renderWizardCategories = renderWizardCategories;

function renderWizardItems() {
    const grid = document.getElementById('wizardItemsGrid');
    if(!grid) return;
    const items = masterItemsData.filter(i => i.category === currentWizardCat);
    grid.innerHTML = items.map(item => {
        const isSelected = !!wizardSelectedItems[item.id];
        return `<div class="panel" style="cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; align-items:center; text-align:center; padding:16px; border: 2px solid ${isSelected ? 'var(--primary)' : 'transparent'}; transition:all 0.2s;" onclick="toggleWizardItem('${item.id}')">
            <strong style="margin-bottom:8px;">${item.name}</strong>
            <span style="font-size:0.8rem; color:var(--text-muted);">${item.unit}</span>
            <div style="margin-top:12px; width:24px; height:24px; border-radius:50%; background:${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; display:flex; align-items:center; justify-content:center;">
                <i data-lucide="check" style="width:14px; height:14px; color:${isSelected ? '#fff' : 'transparent'};"></i>
            </div>
        </div>`;
    }).join('');
    if(window.lucide) window.lucide.createIcons();
}

window.renderWizardItems = renderWizardItems;

function toggleWizardItem(itemId) {
    if (wizardSelectedItems[itemId]) {
        delete wizardSelectedItems[itemId];
    } else {
        wizardSelectedItems[itemId] = true;
    }
    renderWizardItems();
    document.getElementById('wizardSelectedCount').textContent = '(' + Object.keys(wizardSelectedItems).length + ')';
}

window.toggleWizardItem = toggleWizardItem;

function renderWizardReview() {
    const tbody = document.getElementById('wizardReviewTableBody');
    if(!tbody) return;
    tbody.innerHTML = Object.keys(wizardSelectedItems).map(itemId => {
        const item = masterItemsData.find(i => i.id === itemId);
        if(!item) return '';
        return `<tr>
            <td><strong>${item.name}</strong></td>
            <td>${item.category}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" id="wizardQty_${item.id}" min="1" value="1" style="width:80px; padding:6px; border-radius:6px; border:1px solid var(--border); background:var(--dark); color:white;">
                    <span>${item.unit}</span>
                </div>
            </td>
            <td><button class="icon-btn text-danger" onclick="delete wizardSelectedItems['${item.id}']; renderWizardReview(); document.getElementById('wizardSelectedCount').textContent = '(' + Object.keys(wizardSelectedItems).length + ')';"><i data-lucide="trash-2"></i></button></td>
        </tr>`;
    }).join('');
    if(window.lucide) window.lucide.createIcons();
}

window.renderWizardReview = renderWizardReview;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initRequestWizard, 500);
});

// Modifying saveUser and editUser to support assignedSections / cuisines
const originalSaveUser = window.saveUser;
window.saveUser = function() {
    const role = document.getElementById('newUserRole').value;
    const sectionCbs = document.querySelectorAll('.section-checkbox');
    const assignedSections = [];
    sectionCbs.forEach(cb => { if(cb.checked) assignedSections.push(cb.value); });
    
    const editUsername = document.getElementById('editUsername').value;
    const username = document.getElementById('newUserUsername').value.trim();
    
    if(originalSaveUser) originalSaveUser();
    
    const targetUser = editUsername 
        ? usersData.find(u => u.username === editUsername)
        : usersData.find(u => u.username === username);
        
    if(targetUser && role === 'chef') {
        targetUser.assignedSections = assignedSections;
        targetUser.assignedCuisines = assignedSections;
        if(currentUser && currentUser.username === targetUser.username) {
            currentUser.assignedSections = assignedSections;
            currentUser.assignedCuisines = assignedSections;
        }
    }
    saveData();
    if(typeof loadUsersData === 'function') loadUsersData();
};

const originalEditUser = window.editUser;
window.editUser = function(username) {
    if(originalEditUser) originalEditUser(username);
    const user = usersData.find(u => u.username === username);
    if(user && user.role === 'chef') {
        const secGroup = document.getElementById('userSectionsGroup');
        if(secGroup) secGroup.style.display = 'block';
        const assigned = (user.assignedSections || user.assignedCuisines || []).map(s => String(s).toLowerCase());
        const sectionCbs = document.querySelectorAll('.section-checkbox');
        sectionCbs.forEach(cb => {
            cb.checked = assigned.includes(cb.value.toLowerCase());
        });
    } else {
        const secGroup = document.getElementById('userSectionsGroup');
        if(secGroup) secGroup.style.display = 'none';
    }
};

const originalResetUserForm = window.resetUserForm;
window.resetUserForm = function() {
    if(originalResetUserForm) originalResetUserForm();
    const secGroup = document.getElementById('userSectionsGroup');
    if(secGroup) secGroup.style.display = 'none';
    document.querySelectorAll('.section-checkbox').forEach(cb => cb.checked = false);
};

document.getElementById('newUserRole')?.addEventListener('change', (e) => {
    const role = e.target.value;
    const secGroup = document.getElementById('userSectionsGroup');
    if(secGroup) {
        secGroup.style.display = (role === 'chef') ? 'block' : 'none';
    }
});

setTimeout(() => {
    const sBtn = document.getElementById('saveUserBtn');
    if(sBtn) {
        const newBtn = sBtn.cloneNode(true);
        sBtn.parentNode.replaceChild(newBtn, sBtn);
        newBtn.addEventListener('click', window.saveUser);
    }
}, 500);
