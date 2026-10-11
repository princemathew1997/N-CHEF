// ============================================================
// STATE
// ============================================================
let currentUser = null;
let customDateSelected = '';
let currentView = 'viewMasterOrders';
let loaderInterval = null;
let currentStoreView = 'all';

// ============================================================
// CENTER OF SCREEN UI MODAL NOTIFICATION (Matches n.chef Theme)
// ============================================================
window.showUiModal = function(options) {
    let msg = '';
    let title = 'Notice';
    let type = 'success';
    let btnText = 'Got it';
    let callback = null;

    if (typeof options === 'string') {
        msg = options;
        const lower = msg.toLowerCase();
        if (lower.includes('success') || lower.includes('submitted') || lower.includes('approved') || lower.includes('forwarded')) {
            type = 'success';
            title = 'Success';
            btnText = 'Done';
        } else if (lower.includes('not enough') || lower.includes('error') || lower.includes('cannot') || lower.includes('invalid') || lower.includes('required') || lower.includes('already exists') || lower.includes('rejected')) {
            type = 'warning';
            title = 'Attention';
            btnText = 'Understood';
        } else {
            type = 'info';
            title = 'Notice';
            btnText = 'Got it';
        }
    } else if (typeof options === 'object' && options !== null) {
        msg = options.message || '';
        title = options.title || 'Notice';
        type = options.type || 'success';
        btnText = options.btnText || 'Got it';
        callback = options.onConfirm || null;
    }

    const modal = document.getElementById('uiAlertModal');
    if (!modal) {
        console.log(title, msg);
        return;
    }

    const titleEl = document.getElementById('uiAlertTitle');
    const msgEl = document.getElementById('uiAlertMessage');
    const iconContainer = document.getElementById('uiAlertIconContainer');
    const okBtn = document.getElementById('uiAlertOkBtn');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    if (okBtn) okBtn.textContent = btnText;

    if (iconContainer) {
        if (type === 'success') {
            iconContainer.style.background = 'rgba(46, 196, 182, 0.15)';
            iconContainer.style.borderColor = 'rgba(46, 196, 182, 0.4)';
            iconContainer.style.color = '#2ec4b6';
            iconContainer.innerHTML = '<i data-lucide="check-circle" style="width: 30px; height: 30px;"></i>';
        } else if (type === 'warning' || type === 'danger') {
            iconContainer.style.background = 'rgba(230, 57, 70, 0.15)';
            iconContainer.style.borderColor = 'rgba(230, 57, 70, 0.4)';
            iconContainer.style.color = '#ff6b6b';
            iconContainer.innerHTML = '<i data-lucide="alert-circle" style="width: 30px; height: 30px;"></i>';
        } else {
            iconContainer.style.background = 'rgba(255, 190, 11, 0.15)';
            iconContainer.style.borderColor = 'rgba(255, 190, 11, 0.4)';
            iconContainer.style.color = 'var(--primary)';
            iconContainer.innerHTML = '<i data-lucide="info" style="width: 30px; height: 30px;"></i>';
        }
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        modal.classList.add('hidden');
        if (typeof callback === 'function') callback();
        if (okBtn) okBtn.onclick = null;
        document.removeEventListener('keydown', handleKey);
    }

    function handleKey(e) {
        if (e.key === 'Enter' || e.key === 'Escape') {
            closeModal();
        }
    }

    if (okBtn) okBtn.onclick = closeModal;
    document.addEventListener('keydown', handleKey);
};

// Seamlessly route all window.alert calls to the center UI modal!
window.alert = function(msg) {
    window.showUiModal(msg);
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    startLoaderAnimation();
    initParticles();
    initLogin();
    initNavigation();
    initForms();
    initConsumeDatePicker();
    initKeyboardShortcuts();
});

window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.classList.add('hidden');
            if (loaderInterval) clearInterval(loaderInterval);
        }
        
        const loginPage = document.getElementById('page-login');
        if (loginPage && loginPage.classList.contains('active')) {
            loginPage.classList.add('show');
        }
    }, 2500);
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only active on Master Orders view
        if (currentView !== 'viewMasterOrders') return;
        
        // Ignore if user is typing in an input field
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
        
        const key = e.key.toLowerCase();
        let newView = null;
        
        switch(key) {
            case 'o': newView = 'all'; break;
            case 'b': newView = 'brigade'; break;
            case 'v': newView = 'vidyaranyapura'; break;
            case 'm': newView = 'ms-palya'; break;
            case 'y': newView = 'yelahanka'; break;
            case 'c': newView = 'cafe'; break;
        }
        
        if (newView) {
            // Only update if the user has access to this location or it's 'all'
            if (newView === 'all' || currentUser.assignedLocations.includes('all') || currentUser.assignedLocations.includes(newView)) {
                currentStoreView = newView;
                loadMasterOrdersData(); // This rebuilds the table and dropdown to reflect active state
            }
        }
    });
}

// ============================================================
// LOADER ANIMATION
// ============================================================
function startLoaderAnimation() {
    const container = document.getElementById('loaderIconContainer');
    if (!container) return;
    
    const icons = ['chef-hat', 'utensils', 'coffee', 'pizza', 'flame', 'utensils-crossed'];
    let iconIndex = 0;
    
    loaderInterval = setInterval(() => {
        iconIndex = (iconIndex + 1) % icons.length;
        container.innerHTML = `<i data-lucide="${icons[iconIndex]}" class="loader-icon"></i>`;
        lucide.createIcons();
    }, 400);
}

// ============================================================
// PARTICLES BACKGROUND
// ============================================================
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;

    const resize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    const particles = [];
    const numParticles = 80;

    for (let i = 0; i < numParticles; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2.5 + 0.5, // 0.5 to 3
            vx: (Math.random() - 0.5) * 0.2, // very slow horizontal drift
            vy: (Math.random() * -0.3) - 0.1, // slow upward drift
            alpha: Math.random() * 0.6 + 0.1
        });
    }

    function animate() {
        requestAnimationFrame(animate);
        ctx.clearRect(0, 0, width, height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) {
                p.y = height;
                p.x = Math.random() * width;
            }
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 190, 11, ${p.alpha})`;
            
            ctx.shadowBlur = p.radius * 4;
            ctx.shadowColor = 'rgba(255, 190, 11, 0.6)';
            
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    }
    animate();
}

// ============================================================
// LOGIN
// ============================================================
function initLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const userIn   = document.getElementById('username');
    const passIn   = document.getElementById('password');
    const errDiv   = document.getElementById('loginError');

    const doLogin = () => {
        const u = userIn.value.trim();
        const p = passIn.value.trim();
        
        const user = usersData.find(usr => usr.username === u && usr.password === p);
        
        if (user) {
            errDiv.classList.remove('active');
            currentUser = user;
            
            // Populate profile
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userTitle').textContent = user.title;
            document.getElementById('userInitial').textContent = user.name.charAt(0);
            
            // Adjust UI for roles
            const adminEls = document.querySelectorAll('.admin-only');
            const superEls = document.querySelectorAll('.supervisor-only');
            const noChefEls = document.querySelectorAll('.no-chef');
            
            if (user.role === 'admin') {
                adminEls.forEach(el => el.classList.remove('hidden'));
                superEls.forEach(el => el.classList.add('hidden'));
            } else {
                adminEls.forEach(el => el.classList.add('hidden'));
                superEls.forEach(el => el.classList.remove('hidden'));
            }
            
            if (user.role === 'chef') {
                noChefEls.forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.chef-only-bg').forEach(el => el.classList.remove('hidden'));
            } else {
                noChefEls.forEach(el => el.classList.remove('hidden'));
                document.querySelectorAll('.chef-only-bg').forEach(el => el.classList.add('hidden'));
            }
            
            if (document.getElementById('consumePerson')) {
                document.getElementById('consumePerson').value = user.name;
            }
            
            updateRequestsBadge();
            updateIndentsBadge();
            
            // Show dashboard
            document.getElementById('page-login').classList.remove('active');
            document.getElementById('page-dashboard').classList.add('active');
            
            if (user.role === 'chef') {
                document.getElementById('viewMasterOrders').classList.add('hidden');
                document.getElementById('navMasterOrders').classList.remove('active');
                
                const viewChef = document.getElementById('viewChefPortal');
                const navChef = document.getElementById('navChefPortal');
                if (viewChef) viewChef.classList.remove('hidden');
                if (navChef) navChef.classList.add('active');
                
                currentView = 'viewChefPortal';
                loadChefPortalData();
            } else {
                const viewChef = document.getElementById('viewChefPortal');
                const navChef = document.getElementById('navChefPortal');
                if (viewChef) viewChef.classList.add('hidden');
                if (navChef) navChef.classList.remove('active');
                
                // For Admin, Requests screen is hidden — use Indents or Master Orders
                if (user.role === 'admin' && currentView === 'viewRequests') {
                    document.getElementById('viewRequests')?.classList.add('hidden');
                    document.getElementById('navRequests')?.classList.remove('active');
                    const viewIndents = document.getElementById('viewIndents');
                    const navIndents = document.getElementById('navIndents');
                    if (viewIndents && navIndents) {
                        viewIndents.classList.remove('hidden');
                        navIndents.classList.add('active');
                        currentView = 'viewIndents';
                        loadIndentsData();
                    } else {
                        document.getElementById('viewMasterOrders').classList.remove('hidden');
                        document.getElementById('navMasterOrders').classList.add('active');
                        currentView = 'viewMasterOrders';
                        loadDashboardData();
                    }
                } else {
                    document.getElementById('viewMasterOrders').classList.remove('hidden');
                    document.getElementById('navMasterOrders').classList.add('active');
                    currentView = 'viewMasterOrders';
                    loadDashboardData();
                }
            }
        } else {
            errDiv.classList.add('active');
        }
    };

    loginBtn.addEventListener('click', doLogin);
    passIn.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') doLogin();
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        currentUser = null;
        userIn.value = '';
        passIn.value = '';
        document.getElementById('page-dashboard').classList.remove('active');
        document.getElementById('page-login').classList.add('active');
    });
    
    const backHomeBtn = document.getElementById('backHomeBtn');
    if (backHomeBtn) {
        backHomeBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
}

// ============================================================
// NAVIGATION
// ============================================================
function initNavigation() {
    const navMaster = document.getElementById('navMasterOrders');
    const navRequests = document.getElementById('navRequests');
    const navIndents = document.getElementById('navIndents');
    const navChef = document.getElementById('navChefPortal');
    const navVendors = document.getElementById('navVendors');
    const navLocations = document.getElementById('navLocations');
    const navUsers = document.getElementById('navUsers');
    
    const viewMaster = document.getElementById('viewMasterOrders');
    const viewRequests = document.getElementById('viewRequests');
    const viewIndents = document.getElementById('viewIndents');
    const viewChef = document.getElementById('viewChefPortal');
    const viewVendors = document.getElementById('viewVendors');
    const viewLocations = document.getElementById('viewLocations');
    const viewUsers = document.getElementById('viewUsers');
    
    const hideAllViews = () => {
        viewMaster.classList.add('hidden');
        viewRequests.classList.add('hidden');
        if (viewIndents) viewIndents.classList.add('hidden');
        if (viewChef) viewChef.classList.add('hidden');
        viewVendors.classList.add('hidden');
        viewLocations.classList.add('hidden');
        viewUsers.classList.add('hidden');
        
        navMaster.classList.remove('active');
        navRequests.classList.remove('active');
        if (navIndents) navIndents.classList.remove('active');
        if (navChef) navChef.classList.remove('active');
        navVendors.classList.remove('active');
        navLocations.classList.remove('active');
        navUsers.classList.remove('active');
    };

    navMaster.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        viewMaster.classList.remove('hidden');
        navMaster.classList.add('active');
        currentView = 'viewMasterOrders';
        loadDashboardData();
    });

    navRequests.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        viewRequests.classList.remove('hidden');
        navRequests.classList.add('active');
        currentView = 'viewRequests';
        loadRequestsData();
    });

    if (navIndents) {
        navIndents.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllViews();
            if (viewIndents) viewIndents.classList.remove('hidden');
            navIndents.classList.add('active');
            currentView = 'viewIndents';
            loadIndentsData();
        });
    }

    if (navChef) {
        navChef.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllViews();
            if (viewChef) viewChef.classList.remove('hidden');
            navChef.classList.add('active');
            currentView = 'viewChefPortal';
            loadChefPortalData();
        });
    }

    navVendors.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        viewVendors.classList.remove('hidden');
        navVendors.classList.add('active');
        loadVendorsData();
    });

    navLocations.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        viewLocations.classList.remove('hidden');
        navLocations.classList.add('active');
        loadLocationsData();
    });

    navUsers.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllViews();
        viewUsers.classList.remove('hidden');
        navUsers.classList.add('active');
        loadUsersData();
    });
}

function initCustomDatePicker() {
    const trigger = document.getElementById('dpInputTrigger');
    const popup = document.getElementById('dpPopup');
    if (!trigger || !popup) return;
    
    const dpMonth = document.getElementById('dpMonth');
    const dpYear = document.getElementById('dpYear');
    const dpGrid = document.getElementById('dpGrid');
    const dpSelectedText = document.getElementById('dpSelectedText');
    
    // Populate month/year selects
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    dpMonth.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    
    const currentYear = new Date().getFullYear();
    let yearsHtml = '';
    for(let y = currentYear - 5; y <= currentYear + 5; y++) {
        yearsHtml += `<option value="${y}">${y}</option>`;
    }
    dpYear.innerHTML = yearsHtml;
    
    let currentDispDate = new Date();
    let selectedDate = null;
    
    function renderCalendar() {
        const year = parseInt(dpYear.value);
        const month = parseInt(dpMonth.value);
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let html = '';
        for(let i=0; i<firstDay; i++) {
            html += `<div class="dp-cell dp-empty"></div>`;
        }
        
        for(let d=1; d<=daysInMonth; d++) {
            const isSel = selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === d;
            html += `<div class="dp-cell ${isSel ? 'dp-selected' : ''}" data-day="${d}">${d}</div>`;
        }
        dpGrid.innerHTML = html;
        
        dpGrid.querySelectorAll('.dp-cell:not(.dp-empty)').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const d = parseInt(e.target.dataset.day);
                selectedDate = new Date(year, month, d);
                customDateSelected = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                renderCalendar();
            });
        });
    }
    
    dpMonth.value = currentDispDate.getMonth();
    dpYear.value = currentDispDate.getFullYear();
    renderCalendar();
    
    trigger.addEventListener('click', () => popup.classList.toggle('hidden'));
    
    document.getElementById('dpPrev').addEventListener('click', () => {
        let m = parseInt(dpMonth.value) - 1;
        let y = parseInt(dpYear.value);
        if(m < 0) { m = 11; y--; }
        dpMonth.value = m;
        dpYear.value = y;
        renderCalendar();
    });
    
    document.getElementById('dpNext').addEventListener('click', () => {
        let m = parseInt(dpMonth.value) + 1;
        let y = parseInt(dpYear.value);
        if(m > 11) { m = 0; y++; }
        dpMonth.value = m;
        dpYear.value = y;
        renderCalendar();
    });
    
    dpMonth.addEventListener('change', renderCalendar);
    dpYear.addEventListener('change', renderCalendar);
    
    document.getElementById('dpClear').addEventListener('click', () => {
        selectedDate = null;
        customDateSelected = '';
        dpSelectedText.textContent = "Select Date";
        renderCalendar();
        popup.classList.add('hidden');
        loadRequestsData();
    });
    
    document.getElementById('dpConfirm').addEventListener('click', () => {
        if (selectedDate) dpSelectedText.textContent = selectedDate.toLocaleDateString();
        else dpSelectedText.textContent = "Select Date";
        popup.classList.add('hidden');
        loadRequestsData();
    });
    
    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !popup.contains(e.target)) {
            popup.classList.add('hidden');
        }
    });
}

function initConsumeDatePicker() {
    const trigger = document.getElementById('c_dpInputTrigger');
    const popup = document.getElementById('c_dpPopup');
    if (!trigger || !popup) return;
    
    const dpMonth = document.getElementById('c_dpMonth');
    const dpYear = document.getElementById('c_dpYear');
    const dpGrid = document.getElementById('c_dpGrid');
    const dpSelectedText = document.getElementById('c_dpSelectedText');
    const hiddenDateInput = document.getElementById('consumeDate');
    
    // Set default to today
    let today = new Date();
    hiddenDateInput.value = today.toISOString().split('T')[0];
    dpSelectedText.textContent = today.toLocaleDateString();
    
    // Populate month/year selects
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    dpMonth.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    
    const currentYear = new Date().getFullYear();
    let yearsHtml = '';
    for(let y = currentYear - 5; y <= currentYear + 5; y++) {
        yearsHtml += `<option value="${y}">${y}</option>`;
    }
    dpYear.innerHTML = yearsHtml;
    
    let currentDispDate = new Date();
    let selectedDate = new Date();
    
    function renderCalendar() {
        const year = parseInt(dpYear.value);
        const month = parseInt(dpMonth.value);
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let html = '';
        for(let i = 0; i < firstDay; i++) {
            html += `<div class="dp-day empty"></div>`;
        }
        for(let i = 1; i <= daysInMonth; i++) {
            const isSelected = selectedDate && 
                               selectedDate.getDate() === i && 
                               selectedDate.getMonth() === month && 
                               selectedDate.getFullYear() === year;
            html += `<div class="dp-day ${isSelected ? 'selected' : ''}" data-day="${i}">${i}</div>`;
        }
        dpGrid.innerHTML = html;
        
        dpGrid.querySelectorAll('.dp-day:not(.empty)').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedDate = new Date(year, month, parseInt(el.dataset.day));
                renderCalendar();
                
                const tzOffset = selectedDate.getTimezoneOffset() * 60000;
                const localDate = new Date(selectedDate.getTime() - tzOffset);
                hiddenDateInput.value = localDate.toISOString().split('T')[0];
                dpSelectedText.textContent = selectedDate.toLocaleDateString();
                popup.classList.add('hidden');
            });
        });
    }
    
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.classList.toggle('hidden');
        if (!popup.classList.contains('hidden')) {
            if(selectedDate) {
                dpMonth.value = selectedDate.getMonth();
                dpYear.value = selectedDate.getFullYear();
            } else {
                dpMonth.value = currentDispDate.getMonth();
                dpYear.value = currentDispDate.getFullYear();
            }
            renderCalendar();
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !popup.contains(e.target)) {
            popup.classList.add('hidden');
        }
    });
    
    document.getElementById('c_dpPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        let m = parseInt(dpMonth.value) - 1;
        if(m < 0) { m = 11; dpYear.value = parseInt(dpYear.value) - 1; }
        dpMonth.value = m;
        renderCalendar();
    });
    
    document.getElementById('c_dpNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        let m = parseInt(dpMonth.value) + 1;
        if(m > 11) { m = 0; dpYear.value = parseInt(dpYear.value) + 1; }
        dpMonth.value = m;
        renderCalendar();
    });
    
    dpMonth.addEventListener('change', renderCalendar);
    dpYear.addEventListener('change', renderCalendar);
    
    const dpClear = document.getElementById('c_dpClear');
    if (dpClear) {
        dpClear.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedDate = null;
            hiddenDateInput.value = '';
            dpSelectedText.textContent = 'Select Date';
            renderCalendar();
        });
    }
    
    const dpConfirm = document.getElementById('c_dpConfirm');
    if (dpConfirm) {
        dpConfirm.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedDate = new Date();
            hiddenDateInput.value = selectedDate.toISOString().split('T')[0];
            dpSelectedText.textContent = selectedDate.toLocaleDateString();
            popup.classList.add('hidden');
        });
    }
}

// ============================================================
// DASHBOARD LOGIC
// ============================================================
function getVisibleOutlets() {
    if (!currentUser) return outletsData;
    if (currentUser.role === 'admin' || (currentUser.assignedLocations && currentUser.assignedLocations.includes('all'))) {
        return outletsData;
    }
    const matched = outletsData.filter(o => currentUser.assignedLocations && currentUser.assignedLocations.includes(o.id));
    if (matched.length > 0) return matched;
    // Fallback: If supervisor's assigned location was not found or stale, assign to primary outlet
    if (outletsData.length > 0) {
        if (currentUser.role === 'supervisor') {
            currentUser.assignedLocations = [outletsData[0].id];
            saveData();
        }
        return [outletsData[0]];
    }
    return [];
}

function loadDashboardData() {
    const visibleOutlets = getVisibleOutlets();
    const selectedStore = currentStoreView;

    let displayOutlets = visibleOutlets;
    if (selectedStore !== 'all') {
        displayOutlets = visibleOutlets.filter(o => o.id === selectedStore);
    }
    
    // 1. Update Metrics
    document.getElementById('metricTotalItems').textContent = masterItemsData.length;
    document.getElementById('metricActiveOutlets').textContent = visibleOutlets.length;
    
    let lowStockCount = 0;
    masterItemsData.forEach(item => {
        if (getItemStatus(item) === 'Low Stock' || getItemStatus(item) === 'Pending PO') {
            lowStockCount++;
        }
    });
    document.getElementById('metricLowStock').textContent = lowStockCount;

    // 2. Build Table Headers (Condensed)
    const thead = document.getElementById('inventoryTableHeader');
    thead.innerHTML = `
        <th>Item</th>
        <th>Vendor</th>
    `;
    // Abbreviate outlet names for compact view
    const abbreviate = (name) => {
        if (name === 'VIDYARANYAPURA') return 'VIDYA';
        if (name === 'BRIGADE') return 'BRG';
        if (name === 'YELAHANKA') return 'YLH';
        if (name === 'MS PALYA') return 'MSP';
        return name;
    };
    
    if (selectedStore === 'all') {
        thead.innerHTML += `<th style="text-align:center;">Bought</th>`;
    }
    
    displayOutlets.forEach(o => {
        thead.innerHTML += `<th style="text-align:center;">${selectedStore === 'all' ? abbreviate(o.name) : o.name + ' Qty'}</th>`;
        if (selectedStore !== 'all') {
            thead.innerHTML += `<th style="text-align:center;">Consumed</th>`;
            thead.innerHTML += `<th style="text-align:center;">Store Bal.</th>`;
        }
    });

    if (selectedStore === 'all') {
        thead.innerHTML += `<th class="no-chef" style="text-align:center;">Allocated</th>`;
        thead.innerHTML += `<th style="text-align:center;">Balance</th>`;
    }
    if (currentUser.role === 'admin') {
        thead.innerHTML += `<th style="text-align:center;">Actions</th>`;
    }

    // 3. Build Table Body
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    
    masterItemsData.forEach(item => {
        const tr = document.createElement('tr');
        
        let statusDot = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--success); margin-right:8px;" title="In Stock"></span>';
        const st = getItemStatus(item);
        if (st === 'Low Stock' || st === 'Pending PO') {
            statusDot = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--danger); margin-right:8px;" title="Low Stock"></span>';
        } else if (st === 'Allocated/Pending PO') {
            statusDot = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--warning); margin-right:8px;" title="Pending"></span>';
        }
        
        // Combine Item Name, Category, and Unit to save space
        let rowHtml = `
            <td>
                <div style="display:flex; align-items:center;">
                    ${statusDot}
                    <div>
                        <strong>${item.name}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                            ${item.category} &bull; ${item.unit}
                        </div>
                    </div>
                </div>
            </td>
            <td><span style="font-size:0.85rem; color:var(--text-muted);">${item.vendor}</span></td>
        `;

        if (selectedStore === 'all') {
            rowHtml += `<td style="text-align:center; color:var(--text-muted);"><strong>${item.bought || 0}</strong></td>`;
        }
        
        let totalAllocated = 0;
        
        displayOutlets.forEach(o => {
            const qty = item.allocations[o.id] || 0;
            
            // Heatmap color logic applied directly to the main table
            let alpha = qty > 0 ? 0.15 + (qty / 50) : 0;
            if (alpha > 0.6) alpha = 0.6; // Cap the opacity so text is still readable
            let bgStyle = qty > 0 ? `background: rgba(52, 211, 153, ${alpha});` : '';
            
            rowHtml += `<td style="text-align:center; ${bgStyle}">${qty > 0 ? qty : '-'}</td>`;
            
            if (selectedStore !== 'all') {
                const consumed = (item.consumed && item.consumed[o.id]) ? item.consumed[o.id] : 0;
                const balance = qty - consumed;
                let balColor = balance === 0 && qty > 0 ? 'var(--text-muted)' : (balance <= 5 && qty > 0 ? 'var(--warning)' : 'var(--text-main)');
                
                rowHtml += `<td style="text-align:center; color: var(--danger); opacity: 0.8;">${qty > 0 ? consumed : '-'}</td>`;
                rowHtml += `<td style="text-align:center; color: ${balColor};"><strong>${qty > 0 ? balance : '-'}</strong></td>`;
            }
        });
        
        visibleOutlets.forEach(o => {
            totalAllocated += (item.allocations[o.id] || 0);
        });

        const balance = (item.bought || 0) - totalAllocated;
        let balanceColor = 'var(--text-main)';
        if (balance < 0) balanceColor = 'var(--danger)';
        if (balance === 0) balanceColor = 'var(--text-muted)';
        
        if (selectedStore === 'all') {
            rowHtml += `<td class="no-chef" style="text-align:center;"><strong>${totalAllocated}</strong></td>`;
            rowHtml += `<td style="text-align:center; color:${balanceColor};"><strong>${balance}</strong></td>`;
        }
        if (currentUser.role === 'admin') {
            rowHtml += `<td style="text-align:center;"><button class="icon-btn text-danger" onclick="deleteItem('${item.id}')" title="Delete Item"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button></td>`;
        }
        
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    // 4. Update Form Dropdowns
    updateFormSelects(visibleOutlets);
    if (currentUser.role === 'admin') {
        lucide.createIcons();
    }
}

// ============================================================
// FORMS LOGIC
// ============================================================
function initForms() {
    initCustomDatePicker();

    const allocBtn = document.getElementById('allocateBtn');
    allocBtn.addEventListener('click', () => {
        const itemId = document.getElementById('allocItem').value;
        const outletId = document.getElementById('allocOutlet').value;
        const qty = parseInt(document.getElementById('allocQty').value) || 0;
        
        const item = masterItemsData.find(i => i.id === itemId);
        if (item && outletId) {
            // Check if there is enough stock to allocate
            const currentTotal = getItemTotalQty(item);
            const currentOutletQty = item.allocations[outletId] || 0;
            const newTotal = currentTotal - currentOutletQty + qty;
            
            if (newTotal > (item.bought || 0)) {
                const remaining = (item.bought || 0) - currentTotal + currentOutletQty;
                alert(`Cannot allocate ${qty} ${item.unit}. You only have ${remaining} ${item.unit} available to allocate.`);
                return;
            }
            
            item.allocations[outletId] = qty;
            saveData();
            loadDashboardData();
            document.getElementById('allocQty').value = '';
            document.getElementById('allocItem').value = '';
            const allocMsg = document.getElementById('allocAvailableMsg');
            if (allocMsg) {
                allocMsg.style.display = 'none';
                allocMsg.innerHTML = '';
            }
        }
    });
    
    const reqBtn = document.getElementById('requestBtn');
    if (reqBtn) {
        reqBtn.addEventListener('click', () => {
            const itemId = document.getElementById('reqItem').value;
            const outletId = document.getElementById('reqOutlet').value;
            const qty = parseInt(document.getElementById('reqQty').value) || 0;
            
            if (!itemId || !outletId || qty <= 0) {
                alert("Please select an item, an outlet, and enter a valid quantity.");
                return;
            }
            
            requestsData.unshift({
                id: 'req_' + Date.now(),
                itemId,
                outletId,
                qty,
                requestedBy: currentUser.name,
                status: 'Pending',
                timestamp: new Date().toISOString()
            });
            
            saveData();
            document.getElementById('reqQty').value = '';
            alert("Request submitted successfully!");
            updateRequestsBadge();
        });
    }
    
    const clearAllRequestsBtn = document.getElementById('clearAllRequestsBtn');
    if (clearAllRequestsBtn) {
        clearAllRequestsBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear all requests? This action cannot be undone.")) {
                if (currentUser.role === 'admin') {
                    requestsData.length = 0;
                } else {
                    const currentUserName = currentUser.name;
                    for (let i = requestsData.length - 1; i >= 0; i--) {
                        if (requestsData[i].requestedBy === currentUserName) {
                            requestsData.splice(i, 1);
                        }
                    }
                }
                saveData();
                loadRequestsData();
                updateRequestsBadge();
            }
        });
    }
    
    const addVendorBtn = document.getElementById('addVendorBtn');
    addVendorBtn.addEventListener('click', () => {
        const name = document.getElementById('newVendorName').value.trim();
        if (name) {
            vendorsData.push({ id: 'v_' + Date.now(), name });
            saveData();
            document.getElementById('newVendorName').value = '';
            loadVendorsData();
            updateFormSelects(getVisibleOutlets()); // Refresh vendor dropdowns
        }
    });
    
    const addItemBtn = document.getElementById('addItemBtn');
    if(addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            const name = document.getElementById('newItemName').value.trim();
            const unit = document.getElementById('newItemUnit').value.trim();
            const cat = document.getElementById('newItemCategory').value;
            const vendor = document.getElementById('newItemVendor').value;
            const bought = parseInt(document.getElementById('newItemBought').value) || 0;
            
            if (name) {
                masterItemsData.push({
                    id: 'itm_' + Date.now(),
                    name, unit: unit || 'pcs', category: cat, vendor, bought,
                    allocations: {}, consumed: {}
                });
                
                saveData();
                document.getElementById('newItemName').value = '';
                document.getElementById('newItemUnit').value = '';
                document.getElementById('newItemBought').value = '';
                loadDashboardData();
            }
        });
    }
    
    const saveUserBtn = document.getElementById('saveUserBtn');
    if(saveUserBtn) {
        saveUserBtn.addEventListener('click', saveUser);
    }
    
    const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');
    if(cancelEditUserBtn) {
        cancelEditUserBtn.addEventListener('click', resetUserForm);
    }

    const saveLocationBtn = document.getElementById('saveLocationBtn');
    if(saveLocationBtn) {
        saveLocationBtn.addEventListener('click', saveLocation);
    }

    const cancelEditLocationBtn = document.getElementById('cancelEditLocationBtn');
    if(cancelEditLocationBtn) {
        cancelEditLocationBtn.addEventListener('click', resetLocationForm);
    }

    // Consolidation Modal Handlers
    document.getElementById('closeConsolidateModalBtn')?.addEventListener('click', () => {
        document.getElementById('modalConsolidateIndent')?.classList.add('hidden');
    });

    document.getElementById('btnConsolidateBackToStep1')?.addEventListener('click', () => {
        document.getElementById('consolidateStep2')?.classList.add('hidden');
        document.getElementById('consolidateStep1')?.classList.remove('hidden');
    });

    document.getElementById('btnConsolidateGoToStep2')?.addEventListener('click', goToConsolidationStep2);
    document.getElementById('btnConfirmSubmitIndent')?.addEventListener('click', submitConsolidatedIndent);

    document.getElementById('btnToggleAddStockSection')?.addEventListener('click', () => {
        const sec = document.getElementById('sectionAddNewStockItem');
        if (sec) sec.classList.toggle('hidden');
    });

    document.getElementById('btnConfirmAddStockItem')?.addEventListener('click', addSupervisorNewStockItem);

    // Indent Approval Modal Handlers
    document.getElementById('closeIndentApprovalModalBtn')?.addEventListener('click', () => {
        document.getElementById('modalIndentApproval')?.classList.add('hidden');
    });

    document.getElementById('apprModalCloseBtn')?.addEventListener('click', () => {
        document.getElementById('modalIndentApproval')?.classList.add('hidden');
    });

    document.getElementById('btnApproveIndent')?.addEventListener('click', () => {
        const indent = indentsData.find(i => i.id === activeReviewingIndentId);
        if (indent) {
            indent.status = 'Approved';
            // Allocate / add stock to the outlet for each approved ingredient
            indent.items.forEach(it => {
                const mItem = masterItemsData.find(m => m.id === it.itemId);
                if (mItem) {
                    mItem.allocations = mItem.allocations || {};
                    const currentAlloc = mItem.allocations[indent.outletId] || 0;
                    mItem.allocations[indent.outletId] = currentAlloc + (parseFloat(it.revisedQty) || 0);
                }
            });
            // Mark linked chef requests as Approved
            requestsData.forEach(r => {
                if (r.indentId === indent.id) {
                    r.status = 'Approved';
                }
            });
            saveData();
            document.getElementById('modalIndentApproval')?.classList.add('hidden');
            alert(`Indent ${indent.indentNumber || indent.id} approved successfully! Stock has been allocated to ${indent.outletName}.`);
            loadIndentsData();
            loadDashboardData();
        }
    });

    document.getElementById('btnRejectIndent')?.addEventListener('click', () => {
        const indent = indentsData.find(i => i.id === activeReviewingIndentId);
        if (indent) {
            const reason = prompt("Enter reason for rejection:", "Insufficient stock / revised plan");
            if (reason !== null) {
                indent.status = 'Rejected';
                indent.rejectReason = reason;
                // Linked requests become rejected as well
                requestsData.forEach(r => {
                    if (r.indentId === indent.id) {
                        r.status = 'Rejected';
                    }
                });
                saveData();
                document.getElementById('modalIndentApproval')?.classList.add('hidden');
                alert(`Indent ${indent.indentNumber || indent.id} has been rejected.`);
                loadIndentsData();
            }
        }
    });
}

function updateFormSelects(visibleOutlets) {
    const isSingleOutlet = visibleOutlets.length === 1;
    const singleOutlet = isSingleOutlet ? visibleOutlets[0] : null;

    // Helper to setup outlet fields (either hide dropdown and show default allocated outlet, or show select dropdown)
    const setupOutletField = (selectId, displayId, label = 'Outlet') => {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        
        let displayEl = document.getElementById(displayId);
        
        if (isSingleOutlet) {
            sel.innerHTML = `<option value="${singleOutlet.id}" selected>${singleOutlet.name}</option>`;
            sel.value = singleOutlet.id;
            sel.style.display = 'none';
            
            if (!displayEl) {
                displayEl = document.createElement('div');
                displayEl.id = displayId;
                displayEl.className = 'single-outlet-box';
                sel.parentNode.insertBefore(displayEl, sel);
            }
            displayEl.style.display = 'flex';
            displayEl.style.alignItems = 'center';
            displayEl.style.justifyContent = 'space-between';
            displayEl.style.padding = '10px 14px';
            displayEl.style.background = 'rgba(255, 190, 11, 0.08)';
            displayEl.style.border = '1px solid rgba(255, 190, 11, 0.25)';
            displayEl.style.borderRadius = '8px';
            displayEl.style.fontSize = '0.88rem';
            displayEl.innerHTML = `<span>${label}: <strong style="color: var(--primary); font-weight: 600;">${singleOutlet.name}</strong></span>`;
        } else {
            sel.style.display = '';
            if (displayEl) {
                displayEl.style.display = 'none';
            }
            const currentVal = sel.value;
            sel.innerHTML = '<option value="" disabled selected>Select Outlet</option>' + visibleOutlets.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
            if (currentVal && visibleOutlets.some(o => o.id === currentVal)) {
                sel.value = currentVal;
            }
        }
    };
    
    setupOutletField('allocOutlet', 'allocOutletSingleDisplay', 'Outlet');
    setupOutletField('consumeOutlet', 'consumeOutletSingleDisplay', 'Outlet');
    setupOutletField('reqOutlet', 'reqOutletSingleDisplay', 'Outlet');

    // Populate Item Dropdowns
    const itemSel = document.getElementById('allocItem');
    const reqItemSel = document.getElementById('reqItem');
    const consumeItemSel = document.getElementById('consumeItem');
    
    const itemsOptions = '<option value="" disabled selected>Select Item</option>' + masterItemsData.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    
    if (itemSel) {
        const cur = itemSel.value;
        itemSel.innerHTML = itemsOptions;
        if (cur && masterItemsData.some(i => i.id === cur)) {
            itemSel.value = cur;
        } else {
            itemSel.value = '';
        }
    }
    if (consumeItemSel) {
        const cur = consumeItemSel.value;
        consumeItemSel.innerHTML = itemsOptions;
        if (cur && masterItemsData.some(i => i.id === cur)) {
            consumeItemSel.value = cur;
        } else {
            consumeItemSel.value = '';
        }
    }
    if (reqItemSel) {
        reqItemSel.innerHTML = itemsOptions;
    }
    
    // Add real-time hints for available quantity
    const updateAllocHint = () => {
        const iId = itemSel?.value;
        const msg = document.getElementById('allocAvailableMsg');
        if (!msg) return;
        
        // Blank if no item is selected
        if (!iId) {
            msg.style.display = 'none';
            msg.innerHTML = '';
            return;
        }
        
        const item = masterItemsData.find(i => i.id === iId);
        if (item) {
            const totalAlloc = getItemTotalQty(item);
            const avail = (item.bought || 0) - totalAlloc;
            msg.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">Available</span> <div><strong style="color: ${avail > 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 0.95rem;">${avail}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">${item.unit}</span></div>`;
            msg.style.display = 'flex';
        } else {
            msg.style.display = 'none';
            msg.innerHTML = '';
        }
    };
    
    const updateConsumeHint = () => {
        const iId = consumeItemSel?.value;
        const oId = document.getElementById('consumeOutlet')?.value;
        const msg = document.getElementById('consumeAvailableMsg');
        if (!msg) return;
        
        // Blank if no item is selected or no outlet
        if (!iId || !oId) {
            msg.style.display = 'none';
            msg.innerHTML = '';
            return;
        }
        
        const item = masterItemsData.find(i => i.id === iId);
        if (item) {
            const allocated = item.allocations[oId] || 0;
            const consumed = (item.consumed && item.consumed[oId]) ? item.consumed[oId] : 0;
            const avail = allocated - consumed;
            msg.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">Available</span> <div><strong style="color: ${avail > 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 0.95rem;">${avail}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">${item.unit}</span></div>`;
            msg.style.display = 'flex';
        } else {
            msg.style.display = 'none';
            msg.innerHTML = '';
        }
    };
    
    // Always call immediately so it starts blank unless an item is actively selected
    updateAllocHint();
    updateConsumeHint();
    
    if (itemSel && !itemSel.dataset.hintBound) {
        itemSel.addEventListener('change', updateAllocHint);
        itemSel.dataset.hintBound = "true";
    }
    const consumeOutletSel = document.getElementById('consumeOutlet');
    if (consumeItemSel && !consumeItemSel.dataset.hintBound) {
        consumeItemSel.addEventListener('change', updateConsumeHint);
        if (consumeOutletSel) consumeOutletSel.addEventListener('change', updateConsumeHint);
        consumeItemSel.dataset.hintBound = "true";
    }
    
    const outletsOptions = visibleOutlets.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    const filterOutletSel = document.getElementById('filterOutlet');
    if (filterOutletSel) {
        if (currentUser && currentUser.role === 'supervisor' && isSingleOutlet) {
            filterOutletSel.innerHTML = `<option value="${singleOutlet.id}" selected>${singleOutlet.name}</option>`;
            filterOutletSel.value = singleOutlet.id;
            filterOutletSel.style.display = 'none';
            let fDisplay = document.getElementById('filterOutletSingleDisplay');
            if (!fDisplay) {
                fDisplay = document.createElement('div');
                fDisplay.id = 'filterOutletSingleDisplay';
                filterOutletSel.parentNode.insertBefore(fDisplay, filterOutletSel);
            }
            fDisplay.style.display = 'flex';
            fDisplay.style.alignItems = 'center';
            fDisplay.style.gap = '6px';
            fDisplay.style.padding = '6px 12px';
            fDisplay.style.background = 'rgba(255, 190, 11, 0.08)';
            fDisplay.style.border = '1px solid rgba(255, 190, 11, 0.25)';
            fDisplay.style.borderRadius = '6px';
            fDisplay.style.fontSize = '0.8rem';
            fDisplay.style.color = 'var(--text-main)';
            fDisplay.innerHTML = `<span>Outlet: <strong style="color: var(--primary);">${singleOutlet.name}</strong></span>`;
        } else {
            filterOutletSel.style.display = '';
            const fDisplay = document.getElementById('filterOutletSingleDisplay');
            if (fDisplay) fDisplay.style.display = 'none';
            filterOutletSel.innerHTML = '<option value="all">All Outlets</option>' + outletsOptions;
        }
    }
    
    const trigger = document.getElementById('storeViewTrigger');
    const menu = document.getElementById('storeViewMenu');
    const textLabel = document.getElementById('storeViewSelectedText');
    
    if (trigger && menu) {
        menu.innerHTML = '';
        const items = [{ id: 'all', name: 'Overall View' }, ...visibleOutlets];
        
        items.forEach(item => {
            const btn = document.createElement('div');
            const isActive = currentStoreView === item.id;
            btn.style.cssText = `padding: 8px 12px; cursor: pointer; border-radius: 6px; transition: all 0.2s; font-size: 0.85rem; color: ${isActive ? 'var(--primary)' : 'var(--text-main)'}; background: ${isActive ? 'rgba(255,190,11,0.1)' : 'transparent'}; font-weight: ${isActive ? '600' : '400'}; display: flex; align-items: center; gap: 8px;`;
            
            let iconHtml = isActive ? `<i data-lucide="check" style="width: 14px; height: 14px; color: var(--primary);"></i>` : `<span style="width: 14px; display: inline-block;"></span>`;
            btn.innerHTML = `${iconHtml} <span>${item.name}</span>`;
            
            btn.onmouseover = () => { if(!isActive) btn.style.background = 'rgba(255, 255, 255, 0.05)'; };
            btn.onmouseout = () => { if(!isActive) btn.style.background = 'transparent'; };
            
            btn.onclick = () => {
                currentStoreView = item.id;
                menu.classList.add('hidden');
                loadDashboardData();
            };
            menu.appendChild(btn);
        });
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        const activeItem = items.find(i => i.id === currentStoreView) || items[0];
        if (textLabel) textLabel.textContent = activeItem.name;
        
        if (!trigger.dataset.bound) {
            document.addEventListener('click', (e) => {
                if (!trigger.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
            trigger.dataset.bound = 'true';
        }
    }
    
    // Populate Add Item Vendor Dropdown
    const vendorSel = document.getElementById('newItemVendor');
    if (vendorSel) {
        vendorSel.innerHTML = vendorsData.map(v => `<option value="${v.name}">${v.name}</option>`).join('');
    }
}

// ============================================================
// CHEF PORTAL LOGIC
// ============================================================
function loadChefPortalData() {
    if (!currentUser || currentUser.role !== 'chef') return;
    
    // Determine chef's allocated outlet
    let allocatedOutlet = null;
    if (currentUser.assignedLocations && !currentUser.assignedLocations.includes('all')) {
        allocatedOutlet = outletsData.find(o => currentUser.assignedLocations.includes(o.id));
    }
    if (!allocatedOutlet) {
        const vis = getVisibleOutlets();
        allocatedOutlet = vis[0] || outletsData[0] || { id: 'brigade', name: 'BRIGADE' };
    }
    
    const outletNameEl = document.getElementById('chefPortalOutletName');
    if (outletNameEl) outletNameEl.textContent = allocatedOutlet.name;
    
    // Display Chef's assigned cuisine
    let chefCuisines = currentUser.assignedSections || currentUser.assignedCuisines || [];
    if (typeof chefCuisines === 'string' && chefCuisines) chefCuisines = chefCuisines.split(',').map(s => s.trim());
    const cuisineStr = (chefCuisines && chefCuisines.length > 0) ? chefCuisines.join(', ') : 'All Cuisines';
    const cuisineNameEl = document.getElementById('chefPortalCuisineName');
    if (cuisineNameEl) cuisineNameEl.textContent = cuisineStr;
    
    const subtitleEl = document.getElementById('chefPortalSubtitle');
    if (subtitleEl) subtitleEl.textContent = `Request ${cuisineStr} ingredients for ${allocatedOutlet.name}.`;
    
    // Connect portal Raise Request button to open wizard directly
    const portalRaiseBtn = document.getElementById('btnChefPortalRaiseRequest');
    if (portalRaiseBtn && !portalRaiseBtn.dataset.bound) {
        portalRaiseBtn.addEventListener('click', () => {
            if (typeof window.openRequestWizard === 'function') {
                window.openRequestWizard();
            } else {
                const sidebarRaiseBtn = document.getElementById('navSidebarRaiseRequest');
                if (sidebarRaiseBtn) sidebarRaiseBtn.click();
            }
        });
        portalRaiseBtn.dataset.bound = 'true';
    }
    
    // Get all requests for this chef
    const allChefReqs = requestsData.filter(r => (r.chefName === currentUser.name || r.requestedBy === currentUser.name));
    
    // Update summary metric cards
    const pendingCount = allChefReqs.filter(r => r.status === 'Pending' || r.status === 'Sent to Admin').length;
    const approvedCount = allChefReqs.filter(r => r.status === 'Approved' || r.status === 'Consolidated').length;
    const totalCount = allChefReqs.length;
    
    const mPending = document.getElementById('metricChefPending');
    const mApproved = document.getElementById('metricChefApproved');
    const mTotal = document.getElementById('metricChefTotal');
    if (mPending) mPending.textContent = pendingCount;
    if (mApproved) mApproved.textContent = approvedCount;
    if (mTotal) mTotal.textContent = totalCount;
    
    // Setup filter dropdown
    const filterSelect = document.getElementById('chefFilterStatus');
    if (filterSelect && !filterSelect.dataset.bound) {
        filterSelect.addEventListener('change', () => {
            renderChefPortalTable();
        });
        filterSelect.dataset.bound = 'true';
    }
    
    function renderChefPortalTable() {
        const tbody = document.getElementById('chefPortalRequestsTableBody');
        if (!tbody) return;
        
        const currentFilter = filterSelect ? filterSelect.value : 'all';
        const filteredReqs = allChefReqs.filter(r => {
            if (currentFilter === 'all') return true;
            return r.status === currentFilter;
        });
        
        if (filteredReqs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
                <div style="font-size: 1.8rem; margin-bottom: 6px; opacity: 0.5;">📋</div>
                <div style="font-size: 0.95rem; font-weight: 500; color: var(--text-muted);">No ${currentFilter === 'all' ? '' : currentFilter.toLowerCase()} requests found.</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Click "+ Raise Request" above to submit kitchen ingredients.</div>
            </td></tr>`;
            return;
        }
        
        // Sort descending by date/timestamp
        filteredReqs.sort((a, b) => new Date(b.timestamp || b.date || 0) - new Date(a.timestamp || a.date || 0));
        
        tbody.innerHTML = filteredReqs.map(r => {
            const dateStr = (r.timestamp || r.date) ? new Date(r.timestamp || r.date).toLocaleDateString() : '-';
            let statusHtml = '';
            if (r.status === 'Pending') {
                statusHtml = `<span class="status pending" style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pending Supervisor</span>`;
            } else if (r.status === 'Sent to Admin') {
                statusHtml = `<span class="status" style="background: rgba(67,97,238,0.15); color: #4895ef; border: 1px solid rgba(67,97,238,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Sent to Admin</span>`;
            } else if (r.status === 'Consolidated') {
                statusHtml = `<span class="status" style="background: rgba(142,68,173,0.15); color: #af7ac5; border: 1px solid rgba(142,68,173,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Consolidated</span>`;
            } else if (r.status === 'Approved') {
                statusHtml = `<span class="status ok" style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Approved</span>`;
            } else {
                statusHtml = `<span class="status low" style="background: rgba(230,57,70,0.15); color: #e63946; border: 1px solid rgba(230,57,70,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Rejected</span>`;
            }
            
            const outletName = r.outletName || (outletsData.find(o => o.id === r.outletId)?.name) || allocatedOutlet.name;
            
            const actionHtml = r.status === 'Pending' 
                ? `<button class="btn btn-outline" style="padding: 3px 9px; font-size: 0.72rem; border-color: rgba(230,57,70,0.4); color: #ff6b6b; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" onclick="deleteChefRequest('${r.id}')" title="Cancel this pending request">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Cancel
                   </button>`
                : `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
            
            return `
                <tr>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</td>
                    <td><strong>${r.itemName || 'Item'}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${r.unit || 'kg'})</span></td>
                    <td><span style="background: rgba(255,190,11,0.12); color: var(--primary); padding: 2px 7px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${r.cuisine || '-'}</span></td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${outletName}</td>
                    <td><strong style="color: var(--text-main); font-size: 0.95rem;">${r.qty}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">${r.unit || 'kg'}</span></td>
                    <td>${statusHtml}</td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    renderChefPortalTable();
}
window.loadChefPortalData = loadChefPortalData;

window.deleteChefRequest = function(reqId) {
    const reqIndex = requestsData.findIndex(r => r.id === reqId);
    if (reqIndex === -1 || requestsData[reqIndex].status !== 'Pending') return;
    
    if (confirm("Are you sure you want to cancel this request?")) {
        requestsData.splice(reqIndex, 1);
        saveData();
        loadChefPortalData();
        if (typeof loadRequestsData === 'function') loadRequestsData();
        if (typeof updateRequestsBadge === 'function') updateRequestsBadge();
    }
};

// Store inventory removed per user request
function loadStoreInventoryData() {}

// ============================================================
// ADMIN VIEWS
// ============================================================
window.deleteItem = function(itemId) {
    if (confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
        const itemIndex = masterItemsData.findIndex(i => i.id === itemId);
        if (itemIndex > -1) {
            masterItemsData.splice(itemIndex, 1);
            saveData();
            loadDashboardData();
        }
    }
};

// ============================================================
// REQUESTS VIEWS
// ============================================================
function updateRequestsBadge() {
    const badge = document.getElementById('pendingRequestsBadge');
    if (!badge) return;
    
    if (currentUser.role === 'admin') {
        // Admin manages stock through Indents
        badge.classList.add('hidden');
        return;
    } else if (currentUser.role === 'supervisor') {
        const vis = getVisibleOutlets();
        const visIds = vis.map(o => (o.id || '').toLowerCase());
        const visNames = vis.map(o => (o.name || '').toLowerCase());
        const pendingCount = requestsData.filter(r => {
            if (r.status !== 'Pending') return false;
            if (currentUser.assignedLocations && currentUser.assignedLocations.includes('all')) return true;
            const rOutletId = (r.outletId || '').toLowerCase();
            const rOutletName = (r.outletName || '').toLowerCase();
            return visIds.includes(rOutletId) || visNames.includes(rOutletName) || visNames.includes(rOutletId);
        }).length;
        
        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } else {
        badge.classList.add('hidden');
    }
}

function updateIndentsBadge() {
    const badge = document.getElementById('pendingIndentsBadge');
    if (!badge) return;
    
    let pendingIndents = indentsData.filter(ind => ind.status === 'Pending Approval');
    if (currentUser.role === 'supervisor') {
        const vis = getVisibleOutlets().map(o => o.id);
        pendingIndents = pendingIndents.filter(ind => vis.includes(ind.outletId));
    }
    
    if (pendingIndents.length > 0) {
        badge.textContent = pendingIndents.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function loadRequestsData() {
    updateRequestsBadge();
    updateIndentsBadge();
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;
    
    const headerTitle = document.querySelector('#viewRequests .header-title h1');
    const headerSub = document.querySelector('#viewRequests .header-title p');
    if (currentUser.role === 'admin') {
        headerTitle.innerHTML = `Manage <span class="text-primary">Requests</span>`;
        headerSub.textContent = `Review and approve stock requests forwarded by supervisors or submitted by kitchen staff.`;
    } else if (currentUser.role === 'supervisor') {
        headerTitle.innerHTML = `Chef <span class="text-primary">Requests</span>`;
        headerSub.textContent = `Review requests for your allocated outlet, send them to admin, or consolidate into indents.`;
    } else {
        headerTitle.innerHTML = `My <span class="text-primary">Requests</span>`;
        headerSub.textContent = `Track the status of your stock requests.`;
    }
    
    // Consolidate Indent buttons
    const btnCons1 = document.getElementById('btnConsolidateIndent');
    const btnCons2 = document.getElementById('btnConsolidateIndentViewRequests');
    if (btnCons1) {
        btnCons1.style.display = (currentUser.role === 'supervisor') ? 'inline-flex' : 'none';
        if (!btnCons1.dataset.bound) {
            btnCons1.addEventListener('click', openConsolidationModal);
            btnCons1.dataset.bound = 'true';
        }
    }
    if (btnCons2) {
        btnCons2.style.display = (currentUser.role === 'supervisor') ? 'inline-flex' : 'none';
        if (!btnCons2.dataset.bound) {
            btnCons2.addEventListener('click', openConsolidationModal);
            btnCons2.dataset.bound = 'true';
        }
    }
    
    // View switcher tab listeners
    const btnSecMode = document.getElementById('btnViewModeSections');
    const btnListMode = document.getElementById('btnViewModeList');
    const containerSec = document.getElementById('containerSectionsView');
    const containerList = document.getElementById('containerListView');
    
    if (btnSecMode && !btnSecMode.dataset.bound) {
        btnSecMode.addEventListener('click', () => {
            btnSecMode.className = 'btn btn-primary';
            btnListMode.className = 'btn btn-outline';
            if (containerSec) containerSec.classList.remove('hidden');
            if (containerList) containerList.classList.add('hidden');
        });
        btnSecMode.dataset.bound = 'true';
    }
    if (btnListMode && !btnListMode.dataset.bound) {
        btnListMode.addEventListener('click', () => {
            btnListMode.className = 'btn btn-primary';
            btnSecMode.className = 'btn btn-outline';
            if (containerList) containerList.classList.remove('hidden');
            if (containerSec) containerSec.classList.add('hidden');
        });
        btnListMode.dataset.bound = 'true';
    }
    
    // Header action buttons setup
    const btnSendAll = document.getElementById('btnSendAllSectionsToAdmin');
    if (btnSendAll && !btnSendAll.dataset.bound) {
        btnSendAll.addEventListener('click', window.sendAllSectionsToAdmin);
        btnSendAll.dataset.bound = 'true';
    }
    const btnAdminApproveAll = document.getElementById('btnAdminApproveAllSections');
    if (btnAdminApproveAll && !btnAdminApproveAll.dataset.bound) {
        btnAdminApproveAll.addEventListener('click', window.adminApproveAllSections);
        btnAdminApproveAll.dataset.bound = 'true';
    }
    if (btnAdminApproveAll) {
        btnAdminApproveAll.style.display = (currentUser.role === 'admin') ? 'inline-flex' : 'none';
    }

    // Attach filters
    const filterOutlet = document.getElementById('filterOutlet');
    const filterStatus = document.getElementById('filterStatus');
    
    if (filterOutlet && !filterOutlet.dataset.bound) {
        filterOutlet.addEventListener('change', loadRequestsData);
        filterStatus.addEventListener('change', loadRequestsData);
        filterOutlet.dataset.bound = 'true';
    }
    
    let viewableRequests = [];
    if (currentUser.role === 'admin') {
        viewableRequests = requestsData;
    } else if (currentUser.role === 'supervisor') {
        const vis = getVisibleOutlets();
        const visIds = vis.map(o => (o.id || '').toLowerCase());
        const visNames = vis.map(o => (o.name || '').toLowerCase());
        viewableRequests = requestsData.filter(r => {
            if (currentUser.assignedLocations && currentUser.assignedLocations.includes('all')) return true;
            const rOutletId = (r.outletId || '').toLowerCase();
            const rOutletName = (r.outletName || '').toLowerCase();
            return visIds.includes(rOutletId) || visNames.includes(rOutletName) || visNames.includes(rOutletId);
        });
    } else {
        viewableRequests = requestsData.filter(r => (r.chefName === currentUser.name || r.requestedBy === currentUser.name));
    }
        
    const selOutlet = filterOutlet?.value || 'all';
    const selStatus = filterStatus?.value || 'all';
    const selDate = customDateSelected || '';

    if (selOutlet !== 'all') {
        const targetOutlet = outletsData.find(o => o.id === selOutlet);
        const targetName = targetOutlet ? (targetOutlet.name || '').toLowerCase() : '';
        viewableRequests = viewableRequests.filter(r => 
            r.outletId === selOutlet ||
            (targetName && (r.outletId || '').toLowerCase() === targetName) ||
            (targetName && (r.outletName || '').toLowerCase() === targetName)
        );
    }
    if (selStatus !== 'all') {
        viewableRequests = viewableRequests.filter(r => r.status === selStatus);
    }
    if (selDate) {
        viewableRequests = viewableRequests.filter(r => {
            const reqDateStr = new Date(r.timestamp || r.date).toISOString().split('T')[0];
            return reqDateStr === selDate;
        });
    }

    // -------------------------------------------------------------
    // 1. RENDER KITCHEN SECTIONS TABLE (Grouped by Cuisine Section)
    // -------------------------------------------------------------
    if (containerSec) {
        // Filter viewableRequests for ongoing flow in Kitchen Sections Table:
        // 1. Remove 'General' section completely (requests without valid cuisine or marked 'General' are ignored)
        // 2. Focus strictly on ongoing flow: Pending (Pending Supervisor) and Sent to Admin (Awaiting Admin)
        const ongoingSectionRequests = viewableRequests.filter(r => {
            if (!r.cuisine || r.cuisine.toLowerCase() === 'general') return false;
            if (selStatus === 'all') {
                return r.status === 'Pending' || r.status === 'Sent to Admin';
            }
            return true;
        });

        if (ongoingSectionRequests.length === 0) {
            containerSec.innerHTML = `
                <div class="panel" style="text-align: center; padding: 48px 24px; color: var(--text-muted); border-radius: 12px;">
                    <div style="font-size: 2.2rem; margin-bottom: 8px; opacity: 0.6;">🥘</div>
                    <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-main);">No Ongoing Kitchen Section Requests</div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">All chef cuisine requests have been processed, or no pending indents are awaiting review.</p>
                </div>
            `;
        } else {

            // Group ongoing requests by Cuisine Section (Indian, Tandoor, Chinese, Continental, etc.)
            const sectionsMap = {};
            ongoingSectionRequests.forEach(r => {
                const sec = r.cuisine;
                if (!sectionsMap[sec]) sectionsMap[sec] = [];
                sectionsMap[sec].push(r);
            });

            const sectionIcons = {
                'Indian': '🍛',
                'Continental': '🥗',
                'Tandoor': '🍢',
                'Chinese': '🍲',
                'Arabic': '🫓',
                'Kerala': '🥥'
            };

            let sectionsHtml = '';
            for (const secName in sectionsMap) {
                const reqs = sectionsMap[secName];
                const icon = sectionIcons[secName] || '🥘';
                const chefsSet = [...new Set(reqs.map(r => r.chefName || r.requestedBy || 'Store Chef'))];
                const outletsSet = [...new Set(reqs.map(r => r.outletName || (outletsData.find(o => o.id === r.outletId)?.name) || 'Branch'))];
                const totalItemsQty = reqs.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);

                const rowsHtml = reqs.map(r => {
                    const item = masterItemsData.find(i => i.id === r.itemId) || { name: r.itemName || 'Item', unit: r.unit || 'kg' };
                    const dateStr = (r.timestamp || r.date) ? new Date(r.timestamp || r.date).toLocaleDateString() : '-';
                    const outletName = r.outletName || (outletsData.find(o => o.id === r.outletId)?.name) || 'Branch';
                    
                    const parentIndent = r.indentId ? indentsData.find(i => i.id === r.indentId) : null;
                    const indentNum = parentIndent ? (parentIndent.indentNumber || parentIndent.id) : null;

                    let statusBadge = '';
                    if (r.status === 'Pending') {
                        statusBadge = `<span class="status pending" style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pending Supervisor</span>`;
                    } else if (r.status === 'Sent to Admin' || r.status === 'Consolidated') {
                        statusBadge = indentNum 
                            ? `<span class="status" style="background: rgba(67,97,238,0.15); color: #4895ef; border: 1px solid rgba(67,97,238,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">In Indent ${indentNum}</span>`
                            : `<span class="status" style="background: rgba(67,97,238,0.15); color: #4895ef; border: 1px solid rgba(67,97,238,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Sent to Admin</span>`;
                    } else if (r.status === 'Approved') {
                        statusBadge = `<span class="status ok" style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Approved</span>`;
                    } else {
                        statusBadge = `<span class="status low" style="background: rgba(230,57,70,0.15); color: #e63946; border: 1px solid rgba(230,57,70,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Rejected</span>`;
                    }

                    let actionHtml = '';
                    if (currentUser.role === 'admin') {
                        if (r.status === 'Sent to Admin' || r.status === 'Consolidated') {
                            if (r.indentId) {
                                actionHtml = `
                                    <button class="btn btn-outline" style="padding: 3px 8px; font-size: 0.72rem; border-color: var(--primary); color: var(--primary); display: inline-flex; align-items: center; gap: 4px;" onclick="openIndentApprovalModal('${r.indentId}')">
                                        <i data-lucide="file-text" style="width:11px; height:11px;"></i> Review Indent
                                    </button>
                                `;
                            } else {
                                actionHtml = `<span style="font-size: 0.75rem; color: #4895ef; font-weight: 500;">Awaiting Indent Approval</span>`;
                            }
                        } else if (r.status === 'Pending') {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Awaiting Supervisor</span>`;
                        } else if (r.status === 'Approved') {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">✓ Approved</span>`;
                        } else {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
                        }
                    } else if (currentUser.role === 'supervisor') {
                        if (r.status === 'Pending') {
                            actionHtml = `
                                <button class="btn btn-primary" style="padding: 3px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="sendRequestToAdmin('${r.id}')" title="Send this item to Admin">
                                    <i data-lucide="send" style="width:11px; height:11px;"></i> Send
                                </button>
                                <button class="btn btn-outline" style="padding: 3px 8px; font-size: 0.72rem; border-color: var(--danger); color: var(--danger);" onclick="deleteRequest('${r.id}')" title="Delete item">
                                    <i data-lucide="trash-2" style="width:11px; height:11px;"></i>
                                </button>
                            `;
                        } else if (r.status === 'Sent to Admin' || r.status === 'Consolidated') {
                            actionHtml = `<span style="font-size: 0.75rem; color: #4895ef; font-weight: 500;">Awaiting Admin (${indentNum || 'Indent'})</span>`;
                        } else if (r.status === 'Approved') {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">✓ Approved</span>`;
                        } else {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
                        }
                    } else {
                        actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
                    }

                    // Editable quantity input for supervisor
                    const qtyDisplay = (currentUser.role === 'supervisor' && r.status === 'Pending')
                        ? `<div style="display: flex; align-items: center; gap: 6px;">
                            <input type="number" step="0.5" min="0" value="${r.qty}" onchange="updateSectionItemQty('${r.id}', this.value)" style="width: 70px; padding: 3px 6px; font-size: 0.85rem; font-weight: 600; background: var(--dark); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; text-align: center;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${item.unit}</span>
                           </div>`
                        : `<strong>${r.qty}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">${item.unit}</span>`;

                    return `
                        <tr>
                            <td>
                                <strong>${item.name}</strong>
                                <div style="font-size: 0.72rem; color: var(--text-muted);">${dateStr}</div>
                            </td>
                            <td style="font-size: 0.82rem; color: var(--text-muted);">${outletName}</td>
                            <td><strong style="color: var(--text-main); font-size: 0.85rem;">${r.chefName || r.requestedBy || 'Chef'}</strong></td>
                            <td>${qtyDisplay}</td>
                            <td>${statusBadge}</td>
                            <td style="display: flex; gap: 4px; align-items: center;">${actionHtml}</td>
                        </tr>
                    `;
                }).join('');

                sectionsHtml += `
                    <div class="panel" style="padding: 18px 20px; border-radius: 12px; background: rgba(26, 22, 11, 0.85); border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(0,0,0,0.25);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.4rem;">${icon}</span>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--primary);">${secName} Section</h3>
                                        <span style="background: rgba(255,190,11,0.15); color: var(--primary); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">${outletsSet.join(', ')}</span>
                                    </div>
                                    <span style="font-size: 0.76rem; color: var(--text-muted);">Requesting Staff: <strong>${chefsSet.join(', ')}</strong></span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="font-size: 0.82rem; color: var(--text-muted);">
                                    Total in Section: <strong style="color: var(--text-main); font-size: 0.95rem;">${reqs.length} items</strong> (${totalItemsQty.toFixed(1)} units)
                                </div>
                            </div>
                        </div>
                        <div class="table-container" style="max-height: 380px; overflow-y: auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Ingredient</th>
                                        <th>Branch</th>
                                        <th>Requesting Chef</th>
                                        <th>Quantity</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            containerSec.innerHTML = sectionsHtml;
        }
    }

    // -------------------------------------------------------------
    // 2. RENDER FLAT ALL REQUESTS LIST TABLE
    // -------------------------------------------------------------
    if (viewableRequests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No requests found.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = viewableRequests.map(req => {
        const item = masterItemsData.find(i => i.id === req.itemId) || { name: req.itemName || 'Unknown Item', unit: req.unit || 'pcs' };
        const outlet = outletsData.find(o => o.id === req.outletId) || { name: req.outletName || 'Assigned Store' };
        const dateStr = (req.timestamp || req.date) ? new Date(req.timestamp || req.date).toLocaleDateString() : '-';
        
        const parentIndent = req.indentId ? indentsData.find(i => i.id === req.indentId) : null;
        const indentNum = parentIndent ? (parentIndent.indentNumber || parentIndent.id) : null;

        let statusHtml = '';
        if (req.status === 'Pending') {
            statusHtml = `<span class="status pending" style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pending Supervisor</span>`;
        } else if (req.status === 'Sent to Admin' || req.status === 'Consolidated') {
            statusHtml = indentNum 
                ? `<span class="status" style="background: rgba(67,97,238,0.15); color: #4895ef; border: 1px solid rgba(67,97,238,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">In Indent ${indentNum}</span>`
                : `<span class="status" style="background: rgba(67,97,238,0.15); color: #4895ef; border: 1px solid rgba(67,97,238,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Sent to Admin</span>`;
        } else if (req.status === 'Approved') {
            statusHtml = `<span class="status ok" style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Approved</span>`;
        } else {
            statusHtml = `<span class="status low" style="background: rgba(230,57,70,0.15); color: #e63946; border: 1px solid rgba(230,57,70,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Rejected</span>`;
        }
        
        let actionsHtml = '<span class="text-muted">-</span>';
        if (currentUser.role === 'admin') {
            if (req.status === 'Sent to Admin' || req.status === 'Consolidated') {
                if (req.indentId) {
                    actionsHtml = `
                        <button class="btn btn-outline" style="padding: 4px 10px; font-size: 0.72rem; border-color: var(--primary); color: var(--primary); display: inline-flex; align-items: center; gap: 4px;" onclick="openIndentApprovalModal('${req.indentId}')">
                            <i data-lucide="file-text" style="width: 12px; height: 12px;"></i> Review Indent
                        </button>
                    `;
                } else {
                    actionsHtml = `<span style="font-size: 0.75rem; color: #4895ef;">Awaiting Indent Approval</span>`;
                }
            } else if (req.status === 'Pending') {
                actionsHtml = `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Awaiting Supervisor</span>`;
            } else if (req.status === 'Approved') {
                actionsHtml = `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">✓ Approved</span>`;
            } else {
                actionsHtml = `<span style="font-size: 0.75rem; color: var(--danger); font-weight: 600;">✗ Rejected</span>`;
            }
        } else if (currentUser.role === 'supervisor') {
            if (req.status === 'Pending') {
                actionsHtml = `
                    <button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="sendRequestToAdmin('${req.id}')" title="Send this chef request to Admin for approval">
                        <i data-lucide="send" style="width: 12px; height: 12px;"></i> Send to Admin
                    </button>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.72rem; border-color: var(--danger); color: var(--danger);" onclick="deleteRequest('${req.id}')" title="Delete request">Delete</button>
                `;
            } else if (req.status === 'Sent to Admin' || req.status === 'Consolidated') {
                actionsHtml = `<span style="font-size: 0.75rem; color: #4895ef; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> Awaiting Admin (${indentNum || 'Indent'})</span>`;
            } else if (req.status === 'Approved') {
                actionsHtml = `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">✓ Approved</span>`;
            }
        } else {
            if (req.status === 'Pending') {
                actionsHtml = `
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.7rem; border-color: var(--primary); color: var(--primary);" onclick="editRequest('${req.id}')">Edit</button>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.7rem; border-color: var(--danger); color: var(--danger);" onclick="deleteRequest('${req.id}')">Delete</button>
                `;
            }
        }
        
        const chefName = req.chefName || req.requestedBy || 'Store Chef';
        const cuisine = req.cuisine || '-';
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td><strong>${chefName}</strong></td>
                <td><span style="background: rgba(255,190,11,0.12); color: var(--primary); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${cuisine}</span></td>
                <td>${outlet.name}</td>
                <td><strong>${item.name}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${item.unit})</span></td>
                <td><strong>${req.qty}</strong></td>
                <td>${statusHtml}</td>
                <td style="display: flex; gap: 4px; flex-wrap: wrap;">${actionsHtml}</td>
            </tr>
        `;
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================================
// CONSOLIDATION LOGIC (APR-01, APR-02, APR-03, APR-04)
// ============================================================
let activeConsolidationData = null;

function openConsolidationModal() {
    const modal = document.getElementById('modalConsolidateIndent');
    if (!modal) return;
    
    const visibleOutlets = getVisibleOutlets();
    const outlet = visibleOutlets.length > 0 ? visibleOutlets[0] : (outletsData[0] || { id: 'brigade', name: 'BRIGADE' });
    const outletNameLower = (outlet.name || '').toLowerCase();
    
    document.getElementById('consolidateOutletName').textContent = outlet.name;
    document.getElementById('summaryOutletTitle').textContent = `Outlet: ${outlet.name}`;
    
    // Find pending requests for this outlet
    const pendingReqs = requestsData.filter(r => {
        if (r.status !== 'Pending') return false;
        if (r.outletId === outlet.id) return true;
        if (r.outletName && r.outletName.toLowerCase() === outletNameLower) return true;
        if (r.outletId && r.outletId.toLowerCase() === outletNameLower) return true;
        if (!r.outletId || r.outletId === 'o_01') return true;
        return false;
    });
    
    // Group requests by item
    const grouped = {};
    pendingReqs.forEach(r => {
        if (!grouped[r.itemId]) {
            const masterItem = masterItemsData.find(i => i.id === r.itemId) || { id: r.itemId, name: r.itemName || 'Item', unit: r.unit || 'kg', category: 'Dry' };
            grouped[r.itemId] = {
                itemId: r.itemId,
                itemName: masterItem.name,
                category: masterItem.category || 'General',
                unit: masterItem.unit || 'kg',
                originalQty: 0,
                revisedQty: 0,
                comment: '',
                chefRequests: []
            };
        }
        grouped[r.itemId].originalQty += (parseFloat(r.qty) || 0);
        grouped[r.itemId].chefRequests.push({
            id: r.id,
            chef: r.chefName || r.requestedBy || 'Store Chef',
            cuisine: r.cuisine || 'General',
            qty: parseFloat(r.qty) || 0
        });
    });
    
    // Default revisedQty = originalQty
    for (const id in grouped) {
        grouped[id].revisedQty = grouped[id].originalQty;
    }
    
    activeConsolidationData = {
        outletId: outlet.id,
        outletName: outlet.name,
        groupedItems: grouped
    };
    
    renderConsolidationItemsTable();
    
    // Populate new stock item selector
    const newStockSel = document.getElementById('supervisorNewStockItem');
    if (newStockSel) {
        newStockSel.innerHTML = '<option value="" disabled selected>Select Ingredient</option>' + masterItemsData.map(i => `<option value="${i.id}">${i.name} (${i.unit})</option>`).join('');
    }
    
    // Reset view to step 1
    document.getElementById('consolidateStep1').classList.remove('hidden');
    document.getElementById('consolidateStep2').classList.add('hidden');
    document.getElementById('sectionAddNewStockItem').classList.add('hidden');
    
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderConsolidationItemsTable() {
    const tbody = document.getElementById('consolidateItemsTableBody');
    if (!tbody || !activeConsolidationData) return;
    
    const items = Object.values(activeConsolidationData.groupedItems);
    document.getElementById('consolidateItemCount').textContent = `${items.length} ingredient(s) in this indent`;
    
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No pending chef requests found. You can add new stock items using the "+ Add New Stock Item" button above.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = items.map(entry => {
        const breakdownBadges = entry.chefRequests.length > 0
            ? entry.chefRequests.map(cr => `
                <span style="display: inline-flex; align-items: center; gap: 4px; margin: 2px 4px 2px 0; padding: 3px 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.75rem;">
                    <strong style="color: var(--primary);">${cr.cuisine}</strong> (${cr.chef}): <span>${cr.qty} ${entry.unit}</span>
                </span>
            `).join('')
            : `<span style="font-size: 0.75rem; color: var(--primary);">Supervisor Stock Requirement</span>`;
            
        return `
            <tr data-item-id="${entry.itemId}">
                <td>
                    <strong>${entry.itemName}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${entry.category} • ${entry.unit}</div>
                </td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${breakdownBadges}
                    </div>
                </td>
                <td style="text-align: center;">
                    <strong style="font-size: 0.95rem;">${entry.originalQty}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">${entry.unit}</span>
                </td>
                <td>
                    <input type="number" step="any" min="0" class="input-revised-qty" data-id="${entry.itemId}" value="${entry.revisedQty}" style="width: 90px; padding: 6px 8px; background: var(--dark); color: var(--text-main); border: 1px solid var(--border); border-radius: 6px; font-weight: 600;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${entry.unit}</span>
                </td>
                <td>
                    <input type="text" class="input-supervisor-comment" data-id="${entry.itemId}" value="${entry.comment}" placeholder="Reason / comment for alteration..." style="width: 100%; padding: 6px 10px; background: var(--dark); color: var(--text-main); border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem;">
                </td>
            </tr>
        `;
    }).join('');
}

// Step 1 to Step 2: Summary & Routing (APR-04)
function goToConsolidationStep2() {
    if (!activeConsolidationData) return;
    
    // Read current input values
    document.querySelectorAll('.input-revised-qty').forEach(inp => {
        const id = inp.dataset.id;
        if (activeConsolidationData.groupedItems[id]) {
            activeConsolidationData.groupedItems[id].revisedQty = parseFloat(inp.value) || 0;
        }
    });
    
    document.querySelectorAll('.input-supervisor-comment').forEach(inp => {
        const id = inp.dataset.id;
        if (activeConsolidationData.groupedItems[id]) {
            activeConsolidationData.groupedItems[id].comment = inp.value.trim();
        }
    });
    
    const items = Object.values(activeConsolidationData.groupedItems).filter(i => i.revisedQty > 0 || i.originalQty > 0);
    if (items.length === 0) {
        alert("Please ensure at least one ingredient has a valid quantity.");
        return;
    }
    
    let totalQty = 0;
    let alteredCount = 0;
    
    const summaryTbody = document.getElementById('consolidateSummaryTableBody');
    summaryTbody.innerHTML = items.map(it => {
        totalQty += it.revisedQty;
        const diff = it.revisedQty - it.originalQty;
        const isAltered = diff !== 0 || it.comment.length > 0;
        if (isAltered) alteredCount++;
        
        let changeBadge = `<span style="color: var(--text-muted); font-size: 0.8rem;">No change</span>`;
        if (diff > 0) changeBadge = `<span style="color: var(--success); font-weight: 600; font-size: 0.8rem;">+${diff} ${it.unit}</span>`;
        else if (diff < 0) changeBadge = `<span style="color: var(--danger); font-weight: 600; font-size: 0.8rem;">${diff} ${it.unit}</span>`;
        
        return `
            <tr>
                <td><strong>${it.itemName}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${it.unit})</span></td>
                <td>${it.originalQty} ${it.unit}</td>
                <td><strong style="color: var(--primary); font-size: 0.95rem;">${it.revisedQty}</strong> ${it.unit}</td>
                <td>${changeBadge}</td>
                <td><span style="font-size: 0.85rem; color: ${it.comment ? 'var(--text-main)' : 'var(--text-muted)'};">${it.comment || '-'}</span></td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('summaryTotalIngredients').textContent = items.length;
    document.getElementById('summaryTotalQty').textContent = totalQty;
    document.getElementById('summaryAlteredCount').textContent = alteredCount;
    
    document.getElementById('consolidateStep1').classList.add('hidden');
    document.getElementById('consolidateStep2').classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function submitConsolidatedIndent() {
    if (!activeConsolidationData) return;
    
    const items = Object.values(activeConsolidationData.groupedItems).filter(i => i.revisedQty > 0);
    if (items.length === 0) {
        alert("Cannot submit an empty indent.");
        return;
    }
    
    const indentId = 'ind_' + Date.now();
    const indentNumber = 'IND-' + Math.floor(1000 + Math.random() * 9000);
    const today = new Date().toISOString().split('T')[0];
    
    const formattedItems = items.map(entry => {
        // Calculate cuisine breakdown
        const totalOrig = entry.originalQty || entry.revisedQty;
        const breakdown = entry.chefRequests.map(cr => ({
            chef: cr.chef,
            cuisine: cr.cuisine,
            qty: cr.qty
        }));
        
        // If supervisor added directly or if no chef requests, attribute to Supervisor
        if (breakdown.length === 0) {
            breakdown.push({
                chef: currentUser.name,
                cuisine: 'Store Stock',
                qty: entry.revisedQty
            });
        }
        
        return {
            itemId: entry.itemId,
            itemName: entry.itemName,
            category: entry.category,
            unit: entry.unit,
            originalQty: entry.originalQty,
            revisedQty: entry.revisedQty,
            comment: entry.comment,
            cuisineBreakdown: breakdown
        };
    });
    
    const newIndent = {
        id: indentId,
        indentNumber: indentNumber,
        date: today,
        outletId: activeConsolidationData.outletId,
        outletName: activeConsolidationData.outletName,
        supervisorName: currentUser.name,
        status: 'Pending Approval',
        items: formattedItems,
        createdAt: new Date().toISOString()
    };
    
    indentsData.unshift(newIndent);
    
    // Mark source chef requests as Consolidated
    const sourceReqIds = [];
    items.forEach(it => {
        it.chefRequests.forEach(cr => sourceReqIds.push(cr.id));
    });
    
    requestsData.forEach(r => {
        if (sourceReqIds.includes(r.id)) {
            r.status = 'Consolidated';
            r.indentId = indentId;
        }
    });
    
    saveData();
    
    document.getElementById('modalConsolidateIndent').classList.add('hidden');
    alert(`Consolidated Indent ${indentNumber} submitted successfully! Routed to Owner / Admin for approval.`);
    
    loadRequestsData();
    loadIndentsData();
}

// Add new stock item directly in consolidation modal (APR-02)
function addSupervisorNewStockItem() {
    const itemSel = document.getElementById('supervisorNewStockItem');
    const qtyInp = document.getElementById('supervisorNewStockQty');
    const reasonInp = document.getElementById('supervisorNewStockReason');
    
    const itemId = itemSel?.value;
    const qty = parseFloat(qtyInp?.value) || 0;
    const reason = reasonInp?.value.trim() || 'Supervisor Requirement';
    
    if (!itemId) {
        alert("Please select an item.");
        return;
    }
    if (qty <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }
    
    const masterItem = masterItemsData.find(i => i.id === itemId);
    if (!masterItem) return;
    
    if (!activeConsolidationData.groupedItems[itemId]) {
        activeConsolidationData.groupedItems[itemId] = {
            itemId: itemId,
            itemName: masterItem.name,
            category: masterItem.category || 'General',
            unit: masterItem.unit || 'kg',
            originalQty: 0,
            revisedQty: qty,
            comment: reason,
            chefRequests: []
        };
    } else {
        activeConsolidationData.groupedItems[itemId].revisedQty += qty;
        activeConsolidationData.groupedItems[itemId].comment = reason;
    }
    
    qtyInp.value = '';
    reasonInp.value = '';
    itemSel.value = '';
    document.getElementById('sectionAddNewStockItem').classList.add('hidden');
    
    renderConsolidationItemsTable();
}

// ============================================================
// INDENTS VIEW & APPROVAL LOGIC (APR-05)
// ============================================================
// Helper to format indent date consistently for table display
function formatIndentTableDate(indent) {
    if (indent.date && indent.date !== 'undefined' && String(indent.date).trim() !== '') {
        return indent.date;
    }
    if (indent.createdAt) {
        try {
            const d = new Date(indent.createdAt);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            }
        } catch(e) {}
    }
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
}

// Helper to extract a standard YYYY-MM-DD key from indent for date comparisons
function getIndentDateKey(indent) {
    if (indent.createdAt) {
        try {
            const d = new Date(indent.createdAt);
            if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            }
        } catch(e) {}
    }
    const dStr = formatIndentTableDate(indent);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
    const parts = dStr.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
    }
    return '';
}

function loadIndentsData() {
    updateIndentsBadge();
    const tbody = document.getElementById('indentsTableBody');
    if (!tbody) return;
    
    // Normalize any legacy missing or undefined dates
    indentsData.forEach(ind => {
        if (!ind.date || ind.date === 'undefined') {
            ind.date = formatIndentTableDate(ind);
        }
    });

    // Populate outlet filter options if needed
    const outletFilter = document.getElementById('filterIndentsOutlet');
    if (outletFilter && outletFilter.options.length <= 1) {
        const vis = (typeof getVisibleOutlets === 'function') ? getVisibleOutlets() : outletsData;
        outletFilter.innerHTML = '<option value="all">All Outlets</option>' + vis.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    }
    
    // Attach filter listeners once
    if (!window._indentsFilterListenersAttached) {
        window._indentsFilterListenersAttached = true;
        document.getElementById('filterIndentsOutlet')?.addEventListener('change', loadIndentsData);
        document.getElementById('filterIndentsStatus')?.addEventListener('change', loadIndentsData);
        document.getElementById('filterIndentsDate')?.addEventListener('change', loadIndentsData);
        document.getElementById('clearIndentsDateBtn')?.addEventListener('click', () => {
            const dInput = document.getElementById('filterIndentsDate');
            if (dInput) dInput.value = '';
            loadIndentsData();
        });
    }
    
    let viewableIndents = indentsData;
    if (currentUser && currentUser.role === 'supervisor') {
        const vis = (typeof getVisibleOutlets === 'function') ? getVisibleOutlets().map(o => o.id) : [];
        if (vis.length > 0) {
            viewableIndents = indentsData.filter(ind => vis.includes(ind.outletId));
        }
    }

    // Filter by Outlet
    const selectedOutlet = document.getElementById('filterIndentsOutlet')?.value || 'all';
    if (selectedOutlet !== 'all') {
        viewableIndents = viewableIndents.filter(ind => ind.outletId === selectedOutlet);
    }

    // Filter by Status
    const selectedStatus = document.getElementById('filterIndentsStatus')?.value || 'all';
    if (selectedStatus !== 'all') {
        viewableIndents = viewableIndents.filter(ind => ind.status === selectedStatus);
    }

    // Filter by Date (input type="date" returns YYYY-MM-DD)
    const selectedDate = document.getElementById('filterIndentsDate')?.value;
    if (selectedDate) {
        viewableIndents = viewableIndents.filter(ind => {
            const indKey = getIndentDateKey(ind);
            if (indKey === selectedDate) return true;
            const [selY, selM, selD] = selectedDate.split('-');
            const dmy = `${selD}/${selM}/${selY}`;
            const mdy = `${selM}/${selD}/${selY}`;
            return ind.date === dmy || ind.date === mdy || ind.date === selectedDate;
        });
    }
    
    if (viewableIndents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 28px;">No matching consolidated indents found.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = viewableIndents.map(indent => {
        let statusHtml = '';
        if (indent.status === 'Pending Approval') statusHtml = `<span class="status pending">Pending Approval</span>`;
        else if (indent.status === 'Approved') statusHtml = `<span class="status ok">Approved</span>`;
        else statusHtml = `<span class="status low">Rejected</span>`;
        
        const totalQty = (indent.items || []).reduce((sum, item) => sum + (parseFloat(item.revisedQty) || parseFloat(item.originalQty) || 0), 0);
        
        let actionBtn = '';
        if (currentUser && currentUser.role === 'admin') {
            actionBtn = `<button class="btn btn-primary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="openIndentApprovalModal('${indent.id}')">Review & Approve</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline" style="padding: 4px 12px; font-size: 0.75rem;" onclick="openIndentApprovalModal('${indent.id}')">View Breakdown</button>`;
        }
        
        const displayDate = formatIndentTableDate(indent);
        
        return `
            <tr>
                <td><strong style="color: var(--primary);">${indent.indentNumber || indent.id}</strong></td>
                <td>${displayDate}</td>
                <td><strong>${indent.outletName || 'Outlet'}</strong></td>
                <td>${indent.supervisorName || 'Supervisor'}</td>
                <td>${(indent.items || []).length} items</td>
                <td><strong>${totalQty}</strong></td>
                <td>${statusHtml}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

let activeReviewingIndentId = null;

function openIndentApprovalModal(indentId) {
    const indent = indentsData.find(i => i.id === indentId);
    if (!indent) return;
    
    activeReviewingIndentId = indentId;
    const modal = document.getElementById('modalIndentApproval');
    if (!modal) return;
    
    document.getElementById('apprModalIndentId').textContent = indent.indentNumber || indent.id;
    document.getElementById('apprModalOutlet').textContent = indent.outletName || '-';
    document.getElementById('apprModalSupervisor').textContent = indent.supervisorName || '-';
    
    // Format submission date nicely
    const rawDate = indent.createdAt || indent.date || new Date().toISOString();
    let dateDisplay = '-';
    try {
        const d = new Date(rawDate);
        dateDisplay = !isNaN(d) ? d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : rawDate;
    } catch(e) {
        dateDisplay = rawDate;
    }
    document.getElementById('apprModalDate').textContent = dateDisplay;
    
    let statusBadge = `<span class="status ${indent.status === 'Approved' ? 'ok' : (indent.status === 'Rejected' ? 'low' : 'pending')}">${indent.status}</span>`;
    document.getElementById('apprModalStatus').innerHTML = statusBadge;
    
    // Admin buttons visibility
    const adminButtons = document.getElementById('apprModalAdminButtons');
    if (adminButtons) {
        if (currentUser.role === 'admin' && indent.status === 'Pending Approval') {
            adminButtons.style.display = 'flex';
        } else {
            adminButtons.style.display = 'none';
        }
    }
    
    // Render each ingredient with Cuisine Breakdown Table
    const container = document.getElementById('apprModalIngredientsContainer');
    container.innerHTML = indent.items.map(item => {
        const breakdown = item.cuisineBreakdown || [];
        const totalIngredientQty = breakdown.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0) || item.originalQty || item.revisedQty || 1;
        
        const origQ = parseFloat(item.originalQty) || 0;
        const revQ = parseFloat(item.revisedQty) || 0;
        const isAdjusted = Math.abs(revQ - origQ) > 0.001;
        const hasCustomComment = item.comment && item.comment !== 'Consolidated from kitchen sections';
        
        let alterationHtml = '';
        if (isAdjusted) {
            const diff = revQ - origQ;
            alterationHtml = `
                <div style="background: rgba(255,190,11,0.08); border: 1px solid rgba(255,190,11,0.3); border-radius: 6px; padding: 7px 12px; margin-top: 10px; font-size: 0.82rem; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div>
                        <span style="color: var(--primary); font-weight: 700;">⚠️ Supervisor Adjusted:</span>
                        <span style="color: var(--text-muted); text-decoration: line-through; margin-left: 6px;">${item.originalQty} ${item.unit}</span>
                        <strong style="color: var(--text-main); margin-left: 6px;">&rarr; ${item.revisedQty} ${item.unit}</strong>
                        ${diff < 0 ? `<span style="color: var(--danger); font-weight: 700; margin-left: 6px;">(${diff.toFixed(1)} ${item.unit})</span>` : `<span style="color: var(--success); font-weight: 700; margin-left: 6px;">(+${diff.toFixed(1)} ${item.unit})</span>`}
                    </div>
                    ${hasCustomComment ? `<div><span style="color: var(--text-muted);">Note:</span> <em style="color: var(--text-main); font-weight: 500;">"${item.comment}"</em></div>` : ''}
                </div>
            `;
        } else {
            alterationHtml = `
                <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">
                    <span style="background: rgba(46,196,182,0.12); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.25); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">✓ Exact Chef Indent (No supervisor alteration)</span>
                    ${hasCustomComment ? `<span style="font-size: 0.76rem; color: var(--text-muted);">Note: "${item.comment}"</span>` : ''}
                </div>
            `;
        }
        
        // Cuisine breakdown rows with percentage share
        const breakdownRows = breakdown.map(b => {
            const qty = parseFloat(b.qty) || 0;
            const sharePct = ((qty / totalIngredientQty) * 100).toFixed(1);
            return `
                <tr>
                    <td><strong style="color: var(--primary);">${b.cuisine} Section</strong></td>
                    <td><strong style="color: var(--text-main);">${b.chef || 'Chef'}</strong></td>
                    <td style="text-align: right;"><strong>${qty}</strong> ${item.unit}</td>
                    <td style="text-align: right;"><span style="font-weight: 700; color: var(--primary); font-size: 0.92rem;">${sharePct}%</span></td>
                </tr>
            `;
        }).join('');

        const totalRowHtml = breakdown.length > 1 ? `
            <tr style="border-top: 2px solid var(--border); background: rgba(255,255,255,0.02); font-weight: bold;">
                <td>Total Across Sections</td>
                <td>-</td>
                <td style="text-align: right;">${totalIngredientQty} ${item.unit}</td>
                <td style="text-align: right; color: var(--primary);">100.0%</td>
            </tr>
        ` : '';
        
        return `
            <div class="panel" style="padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: rgba(0,0,0,0.25);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-main);">${item.itemName}</h3>
                        <span style="background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; color: var(--text-muted); display: inline-block; margin-top: 4px;">${item.category || 'Kitchen Ingredient'}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Consolidated Indent Qty:</span>
                        <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">${item.revisedQty} ${item.unit}</div>
                    </div>
                </div>
                
                ${alterationHtml}
                
                <div style="margin-top: 14px;">
                    <div style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px;">
                        Kitchen Section Breakdown
                    </div>
                    <div class="table-container" style="background: rgba(0,0,0,0.2); border-radius: 6px;">
                        <table style="width: 100%; font-size: 0.85rem;">
                            <thead>
                                <tr>
                                    <th style="width: 30%;">Cuisine Section</th>
                                    <th style="width: 30%;">Requesting Chef</th>
                                    <th style="width: 20%; text-align: right;">Quantity</th>
                                    <th style="width: 20%; text-align: right;">% Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${breakdownRows}
                                ${totalRowHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.openConsolidationModal = openConsolidationModal;
window.openIndentApprovalModal = openIndentApprovalModal;

window.approveRequest = function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req) return;
    
    const item = masterItemsData.find(i => i.id === req.itemId);
    if (!item) {
        alert("Item no longer exists.");
        return;
    }
    
    // Check stock
    const currentTotal = getItemTotalQty(item);
    const available = (item.bought || 0) - currentTotal;
    
    let approveQtyStr = prompt(`Requested: ${req.qty}. Available in stock: ${available}.\nEnter amount to allocate:`, Math.min(req.qty, available));
    
    if (approveQtyStr === null) return;
    
    const approveQty = parseFloat(approveQtyStr);
    
    if (isNaN(approveQty) || approveQty <= 0) {
        alert("Invalid quantity.");
        return;
    }
    
    if (approveQty > available) {
        alert(`Not enough stock. You only have ${available} available.`);
        return;
    }
    
    const currentOutletQty = item.allocations[req.outletId] || 0;
    item.allocations[req.outletId] = currentOutletQty + approveQty;
    
    req.status = 'Approved';
    req.qty = approveQty;
    
    saveData();
    loadRequestsData();
    loadDashboardData();
};

window.rejectRequest = function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (req) {
        req.status = 'Rejected';
        saveData();
        loadRequestsData();
        if (typeof loadChefPortalData === 'function') loadChefPortalData();
        updateRequestsBadge();
    }
};

window.sendRequestToAdmin = function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req || req.status !== 'Pending') return;
    
    const chefDisplay = req.chefName || req.requestedBy || 'Chef';
    const promptMsg = `Send "${req.itemName}" (${req.qty} ${req.unit || 'kg'}) from ${chefDisplay} to Admin for approval?\nClick OK to forward, or change quantity:`;
    const newQtyStr = prompt(promptMsg, req.qty);
    if (newQtyStr === null) return;
    
    const newQty = parseFloat(newQtyStr);
    if (!isNaN(newQty) && newQty > 0) {
        req.qty = newQty;
    }
    
    req.status = 'Sent to Admin';
    req.forwardedBy = (currentUser && currentUser.name) ? currentUser.name : 'Supervisor';
    req.forwardedAt = new Date().toISOString();
    
    saveData();
    loadRequestsData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    
    alert(`Request for ${req.itemName} (${req.qty} ${req.unit || 'kg'}) forwarded to Admin for approval!`);
};

window.updateSectionItemQty = function(reqId, val) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req) return;
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
        req.qty = num;
        saveData();
    }
};

window.sendAllSectionsToAdmin = function() {
    const vis = getVisibleOutlets();
    const visIds = vis.map(o => (o.id || '').toLowerCase());
    const outlet = vis[0] || outletsData[0] || { id: 'brigade', name: 'BRIGADE' };
    
    // Find all ongoing pending requests for this supervisor's outlet with assigned cuisine
    const pendingReqs = requestsData.filter(r => {
        if (r.status !== 'Pending') return false;
        if (!r.cuisine || r.cuisine.toLowerCase() === 'general') return false;
        const rOutletId = (r.outletId || '').toLowerCase();
        return visIds.includes(rOutletId) || (currentUser.assignedLocations && currentUser.assignedLocations.includes('all'));
    });
    
    if (pendingReqs.length === 0) {
        alert("No pending kitchen section requests to submit.");
        return;
    }
    
    const indentNumber = 'IND-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(100 + Math.random() * 900);
    const indentId = 'ind_' + Date.now();
    
    // Group by item for consolidated indent with cuisine breakdown
    const grouped = {};
    pendingReqs.forEach(r => {
        if (!grouped[r.itemId]) {
            const masterItem = masterItemsData.find(i => i.id === r.itemId) || { name: r.itemName || 'Item', unit: r.unit || 'kg', category: 'Kitchen' };
            grouped[r.itemId] = {
                itemId: r.itemId,
                itemName: masterItem.name,
                category: masterItem.category || 'Kitchen',
                unit: masterItem.unit || 'kg',
                originalQty: 0,
                revisedQty: 0,
                comment: '',
                cuisineBreakdown: []
            };
        }
        const q = parseFloat(r.qty) || 0;
        grouped[r.itemId].originalQty += q;
        grouped[r.itemId].revisedQty += q;
        grouped[r.itemId].cuisineBreakdown.push({
            cuisine: r.cuisine || 'Cuisine Section',
            chef: r.chefName || r.requestedBy || 'Chef',
            qty: q
        });
    });
    
    const nowIso = new Date().toISOString();
    const newIndent = {
        id: indentId,
        indentNumber: indentNumber,
        outletId: outlet.id,
        outletName: outlet.name,
        supervisorName: currentUser.name || 'Supervisor',
        status: 'Pending Approval',
        items: Object.values(grouped),
        date: new Date().toLocaleDateString(),
        createdAt: nowIso
    };
    
    indentsData.unshift(newIndent);
    
    // Mark requests as Sent to Admin
    pendingReqs.forEach(r => {
        r.status = 'Sent to Admin';
        r.indentId = indentId;
        r.forwardedBy = currentUser.name || 'Supervisor';
        r.forwardedAt = new Date().toISOString();
    });
    
    saveData();
    loadRequestsData();
    loadIndentsData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    updateIndentsBadge();
    
    alert(`Successfully submitted ${pendingReqs.length} section item requests from ${outlet.name} to Admin for approval!`);
};

window.adminApproveAllSections = function() {
    const filterOutlet = document.getElementById('filterOutlet')?.value || 'all';
    const targetReqs = requestsData.filter(r => {
        if (r.status !== 'Sent to Admin' && r.status !== 'Pending') return false;
        if (filterOutlet !== 'all' && r.outletId !== filterOutlet) return false;
        return true;
    });
    
    if (targetReqs.length === 0) {
        alert("No pending section requests to approve.");
        return;
    }
    
    if (!confirm(`Approve all ${targetReqs.length} section requests and allocate stock to the respective outlets?`)) return;
    
    targetReqs.forEach(req => {
        const item = masterItemsData.find(i => i.id === req.itemId);
        if (item) {
            item.allocations = item.allocations || {};
            const curAlloc = item.allocations[req.outletId] || 0;
            item.allocations[req.outletId] = curAlloc + (parseFloat(req.qty) || 0);
        }
        req.status = 'Approved';
    });
    
    // Also approve matching indents if any
    indentsData.forEach(ind => {
        if (ind.status === 'Pending Approval') {
            if (filterOutlet === 'all' || ind.outletId === filterOutlet) {
                ind.status = 'Approved';
            }
        }
    });
    
    saveData();
    loadRequestsData();
    loadIndentsData();
    loadDashboardData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    updateIndentsBadge();
    
    alert(`Successfully approved all ${targetReqs.length} section requests! Stock allocated to outlets.`);
};

window.editRequest = function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req || req.status !== 'Pending') return;
    
    let newQtyStr = prompt("Enter new quantity for this request:", req.qty);
    if (newQtyStr === null) return;
    
    const newQty = parseFloat(newQtyStr);
    if (isNaN(newQty) || newQty <= 0) {
        alert("Invalid quantity.");
        return;
    }
    
    req.qty = newQty;
    saveData();
    loadRequestsData();
};

window.deleteRequest = function(reqId) {
    const reqIndex = requestsData.findIndex(r => r.id === reqId);
    if (reqIndex === -1 || requestsData[reqIndex].status !== 'Pending') return;
    
    if (confirm("Are you sure you want to delete this request?")) {
        requestsData.splice(reqIndex, 1);
        saveData();
        loadRequestsData();
        updateRequestsBadge();
    }
};

function loadVendorsData() {
    const tbody = document.getElementById('vendorsTableBody');
    tbody.innerHTML = vendorsData.map(v => `
        <tr>
            <td>${v.name}</td>
            <td><button class="icon-btn text-danger" onclick="removeVendor('${v.id}')"><i data-lucide="trash-2"></i></button></td>
        </tr>
    `).join('');
    lucide.createIcons();
}

window.removeVendor = function(id) {
    const idx = vendorsData.findIndex(v => v.id === id);
    if (idx > -1) {
        vendorsData.splice(idx, 1);
        saveData();
        loadVendorsData();
        updateFormSelects(getVisibleOutlets());
    }
};

function loadUsersData() {
    const cbContainer = document.getElementById('userLocationsCheckboxes');
    if (cbContainer && cbContainer.children.length === 0) {
        let html = `<label style="display:flex; align-items:center; gap:8px; font-weight: 500;"><input type="checkbox" class="user-loc-cb" value="all"> All Locations</label>`;
        outletsData.forEach(o => {
            html += `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="user-loc-cb" value="${o.id}"> ${o.name}</label>`;
        });
        cbContainer.innerHTML = html;
    }

    const secContainer = document.getElementById('userSectionsCheckboxes');
    if (secContainer && secContainer.children.length === 0) {
        const cuisines = (typeof cuisinesData !== 'undefined' && cuisinesData.length > 0) ? cuisinesData : [
            { id: 'c_01', name: 'Indian' },
            { id: 'c_02', name: 'Continental' },
            { id: 'c_03', name: 'Tandoor' },
            { id: 'c_04', name: 'Chinese' },
            { id: 'c_05', name: 'Arabic' },
            { id: 'c_06', name: 'Kerala' }
        ];
        secContainer.innerHTML = cuisines.map(c => `
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" value="${c.name}" class="section-checkbox"> ${c.name}
            </label>
        `).join('');
    }

    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = usersData.map(u => {
        const assignedCuisines = u.assignedSections || u.assignedCuisines || [];
        const cuisinesDisplay = (u.role === 'chef' && assignedCuisines.length > 0)
            ? `<div style="font-size: 0.72rem; color: var(--primary); font-weight: 600; margin-top: 3px;">Cuisines: ${assignedCuisines.join(', ')}</div>`
            : '';
        return `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td>${u.username}</td>
                <td><span class="status ok">${u.role}</span></td>
                <td class="text-muted">
                    <div>${u.assignedLocations.join(', ')}</div>
                    ${cuisinesDisplay}
                </td>
                <td style="display: flex; gap: 4px;">
                    <button class="icon-btn" onclick="editUser('${u.username}')" title="Edit"><i data-lucide="edit"></i></button>
                    <button class="icon-btn text-danger" onclick="removeUser('${u.username}')" title="Remove"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

function saveUser() {
    const editUsername = document.getElementById('editUsername').value;
    const name = document.getElementById('newUserName').value.trim();
    const username = document.getElementById('newUserUsername').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const role = document.getElementById('newUserRole').value;
    
    const checkboxes = document.querySelectorAll('.user-loc-cb');
    const assignedLocations = [];
    checkboxes.forEach(cb => {
        if(cb.checked) assignedLocations.push(cb.value);
    });
    
    const sectionCbs = document.querySelectorAll('.section-checkbox');
    const assignedSections = [];
    sectionCbs.forEach(cb => {
        if(cb.checked) assignedSections.push(cb.value);
    });
    
    if(!name || !username) {
        alert("Name and username are required.");
        return;
    }
    
    if (editUsername) {
        const user = usersData.find(u => u.username === editUsername);
        if (user) {
            user.name = name;
            user.username = username;
            if(password) user.password = password;
            user.role = role;
            user.assignedLocations = assignedLocations;
            if (role === 'chef') {
                user.assignedSections = assignedSections;
                user.assignedCuisines = assignedSections;
            }
            if (currentUser && currentUser.username === user.username) {
                currentUser.assignedLocations = assignedLocations;
                if (role === 'chef') {
                    currentUser.assignedSections = assignedSections;
                    currentUser.assignedCuisines = assignedSections;
                }
            }
        }
    } else {
        if(!password) {
            alert("Password is required for new users.");
            return;
        }
        if(usersData.find(u => u.username === username)) {
            alert("Username already exists.");
            return;
        }
        const newUser = {
            name, 
            username, 
            password, 
            role, 
            assignedLocations, 
            assignedSections: role === 'chef' ? assignedSections : [],
            assignedCuisines: role === 'chef' ? assignedSections : [],
            title: role === 'admin' ? 'Manager' : (role === 'chef' ? 'Store Chef' : 'Supervisor')
        };
        usersData.push(newUser);
    }
    
    saveData();
    resetUserForm();
    loadUsersData();
}

function resetUserForm() {
    document.getElementById('userFormTitle').textContent = 'Add User';
    document.getElementById('editUsername').value = '';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserRole').value = 'supervisor';
    document.getElementById('cancelEditUserBtn').classList.add('hidden');
    document.querySelectorAll('.user-loc-cb').forEach(cb => cb.checked = false);
    
    const secGroup = document.getElementById('userSectionsGroup');
    if (secGroup) secGroup.style.display = 'none';
    document.querySelectorAll('.section-checkbox').forEach(cb => cb.checked = false);
}

window.editUser = function(username) {
    const user = usersData.find(u => u.username === username);
    if (!user) return;
    
    document.getElementById('userFormTitle').textContent = 'Edit User';
    document.getElementById('editUsername').value = user.username;
    document.getElementById('newUserName').value = user.name;
    document.getElementById('newUserUsername').value = user.username;
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserRole').value = user.role;
    
    document.querySelectorAll('.user-loc-cb').forEach(cb => {
        cb.checked = user.assignedLocations.includes('all') || user.assignedLocations.includes(cb.value);
    });
    
    const secGroup = document.getElementById('userSectionsGroup');
    if (secGroup) {
        secGroup.style.display = (user.role === 'chef') ? 'block' : 'none';
        const assigned = (user.assignedSections || user.assignedCuisines || []).map(s => String(s).toLowerCase());
        document.querySelectorAll('.section-checkbox').forEach(cb => {
            cb.checked = assigned.includes(cb.value.toLowerCase());
        });
    }
    
    document.getElementById('cancelEditUserBtn').classList.remove('hidden');
};

window.removeUser = function(username) {
    if(currentUser && username === currentUser.username) {
        alert("You cannot remove yourself while logged in.");
        return;
    }
    const idx = usersData.findIndex(u => u.username === username);
    if (idx > -1) {
        usersData.splice(idx, 1);
        saveData();
        loadUsersData();
    }
};

function loadLocationsData() {
    const tbody = document.getElementById('locationsTableBody');
    tbody.innerHTML = outletsData.map(o => `
        <tr>
            <td>${o.id}</td>
            <td><strong>${o.name}</strong></td>
            <td style="display: flex; gap: 4px;">
                <button class="icon-btn" onclick="editLocation('${o.id}')" title="Edit"><i data-lucide="edit"></i></button>
                <button class="icon-btn text-danger" onclick="removeLocation('${o.id}')" title="Remove"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function saveLocation() {
    const editId = document.getElementById('editLocationId').value;
    const id = document.getElementById('newLocationId').value.trim();
    const name = document.getElementById('newLocationName').value.trim();
    
    if(!id || !name) {
        alert("Location ID and Name are required.");
        return;
    }
    
    if (editId) {
        const loc = outletsData.find(o => o.id === editId);
        if (loc) {
            loc.id = id;
            loc.name = name;
        }
    } else {
        if(outletsData.find(o => o.id === id)) {
            alert("Location ID already exists.");
            return;
        }
        outletsData.push({ id, name });
    }
    
    saveData();
    resetLocationForm();
    loadLocationsData();
    
    // Clear user locations checkboxes so they rebuild with new data
    const cbContainer = document.getElementById('userLocationsCheckboxes');
    if (cbContainer) cbContainer.innerHTML = '';
}

function resetLocationForm() {
    document.getElementById('locationFormTitle').textContent = 'Add Location';
    document.getElementById('editLocationId').value = '';
    document.getElementById('newLocationId').value = '';
    document.getElementById('newLocationName').value = '';
    document.getElementById('cancelEditLocationBtn').classList.add('hidden');
}

window.editLocation = function(id) {
    const loc = outletsData.find(o => o.id === id);
    if (!loc) return;
    
    document.getElementById('locationFormTitle').textContent = 'Edit Location';
    document.getElementById('editLocationId').value = loc.id;
    document.getElementById('newLocationId').value = loc.id;
    document.getElementById('newLocationName').value = loc.name;
    document.getElementById('cancelEditLocationBtn').classList.remove('hidden');
};

window.removeLocation = function(id) {
    const idx = outletsData.findIndex(o => o.id === id);
    if (idx > -1) {
        outletsData.splice(idx, 1);
        saveData();
        loadLocationsData();
        
        // Clear user locations checkboxes so they rebuild with new data
        const cbContainer = document.getElementById('userLocationsCheckboxes');
        if (cbContainer) cbContainer.innerHTML = '';
    }
};

// ============================================================
// GLOBAL KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
    // Only apply if on Master Orders view and a user is logged in
    if (!currentUser || currentView !== 'viewMasterOrders') return;
    
    // Ignore if user is typing in an input, textarea, or select
    if (document.activeElement) {
        const activeTag = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea', 'select'].includes(activeTag)) return;
    }
    
    const key = e.key.toLowerCase();
    
    // Check if the menu is visible to the user
    const trigger = document.getElementById('storeViewTrigger');
    if (!trigger) return;

    if (key === 'o') {
        currentStoreView = 'all';
        loadDashboardData();
        return;
    }
    
    const visibleOutlets = currentUser.role === 'admin' ? outletsData : outletsData.filter(o => currentUser.assignedLocations.includes('all') || currentUser.assignedLocations.includes(o.id));
    const matchedOutlet = visibleOutlets.find(o => o.name.toLowerCase().startsWith(key));
    
    if (matchedOutlet) {
        currentStoreView = matchedOutlet.id;
        loadDashboardData();
    }
});
