// ============================================================
// STATE
// ============================================================
let currentUser = null;
let customDateSelected = '';
let currentView = 'viewMasterOrders';
let currentStoreView = '';
let currentCuisineFilter = 'all';

// ============================================================
// CENTER OF SCREEN UI MODAL NOTIFICATION (Matches n.chef Theme)
// ============================================================
window.showUiModal = function(options) {
    return new Promise((resolve) => {
        let msg = '';
        let title = 'Notice';
        let type = 'info';
        let btnText = 'Got it';
        let isConfirm = false;
        let isPrompt = false;
        let defaultValue = '';
        let inputType = 'text';
        let onConfirm = null;
        let onCancel = null;

        if (typeof options === 'string') {
            msg = options;
            const lower = msg.toLowerCase();
            if (lower.includes('success') || lower.includes('submitted') || lower.includes('approved') || lower.includes('forwarded') || lower.includes('allocated')) {
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
            type = options.type || 'info';
            btnText = options.confirmText || options.btnText || (options.isConfirm ? 'Confirm' : 'Got it');
            isConfirm = !!options.isConfirm;
            isPrompt = !!options.isPrompt;
            defaultValue = options.defaultValue !== undefined ? options.defaultValue : '';
            inputType = options.inputType || 'text';
            onConfirm = options.onConfirm || null;
            onCancel = options.onCancel || null;
        }

        const modal = document.getElementById('uiAlertModal');
        if (!modal) {
            console.log(title, msg);
            if (onConfirm) onConfirm(isPrompt ? defaultValue : true);
            resolve(isPrompt ? defaultValue : true);
            return;
        }

        const titleEl = document.getElementById('uiAlertTitle');
        const msgEl = document.getElementById('uiAlertMessage');
        const iconContainer = document.getElementById('uiAlertIconContainer');
        const okBtn = document.getElementById('uiAlertOkBtn');
        const cancelBtn = document.getElementById('uiAlertCancelBtn');
        const inputWrapper = document.getElementById('uiAlertInputWrapper');
        const inputEl = document.getElementById('uiAlertInput');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = msg;
        if (okBtn) {
            okBtn.textContent = btnText;
            const isDanger = type === 'danger' || (isConfirm && (title.toLowerCase().includes('delete') || title.toLowerCase().includes('cancel') || title.toLowerCase().includes('clear') || msg.toLowerCase().includes('cancel')));
            if (isDanger) {
                okBtn.style.background = 'linear-gradient(135deg, #e63946, #c1121f)';
                okBtn.style.boxShadow = '0 4px 16px rgba(230, 57, 70, 0.4)';
                okBtn.style.color = '#ffffff';
            } else {
                okBtn.style.background = '';
                okBtn.style.boxShadow = '0 4px 16px rgba(255, 190, 11, 0.3)';
                okBtn.style.color = '';
            }
        }

        if (isPrompt && inputWrapper && inputEl) {
            inputWrapper.style.display = 'block';
            inputEl.type = inputType;
            inputEl.value = defaultValue;
            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 60);
        } else if (inputWrapper) {
            inputWrapper.style.display = 'none';
        }

        if (cancelBtn) {
            cancelBtn.style.display = (isConfirm || isPrompt) ? 'inline-block' : 'none';
            cancelBtn.textContent = (options && options.cancelText) ? options.cancelText : 'Cancel';
        }

        if (iconContainer) {
            if (type === 'success') {
                iconContainer.style.background = 'rgba(46, 196, 182, 0.15)';
                iconContainer.style.borderColor = 'rgba(46, 196, 182, 0.4)';
                iconContainer.style.color = '#2ec4b6';
                iconContainer.innerHTML = '<i data-lucide="check-circle" style="width: 32px; height: 32px;"></i>';
            } else if (type === 'danger' || type === 'warning') {
                iconContainer.style.background = 'rgba(230, 57, 70, 0.15)';
                iconContainer.style.borderColor = 'rgba(230, 57, 70, 0.4)';
                iconContainer.style.color = '#ff6b6b';
                iconContainer.innerHTML = '<i data-lucide="alert-triangle" style="width: 32px; height: 32px;"></i>';
            } else if (isConfirm) {
                iconContainer.style.background = 'rgba(255, 190, 11, 0.15)';
                iconContainer.style.borderColor = 'rgba(255, 190, 11, 0.4)';
                iconContainer.style.color = 'var(--primary)';
                iconContainer.innerHTML = '<i data-lucide="help-circle" style="width: 32px; height: 32px;"></i>';
            } else {
                iconContainer.style.background = 'rgba(255, 190, 11, 0.15)';
                iconContainer.style.borderColor = 'rgba(255, 190, 11, 0.4)';
                iconContainer.style.color = 'var(--primary)';
                iconContainer.innerHTML = '<i data-lucide="info" style="width: 32px; height: 32px;"></i>';
            }
        }

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();

        function cleanup() {
            modal.classList.add('hidden');
            if (okBtn) okBtn.onclick = null;
            if (cancelBtn) cancelBtn.onclick = null;
            document.removeEventListener('keydown', handleKey);
        }

        function handleConfirm() {
            const val = (isPrompt && inputEl) ? inputEl.value : true;
            cleanup();
            if (typeof onConfirm === 'function') onConfirm(val);
            resolve(val);
        }

        function handleCancel() {
            cleanup();
            if (typeof onCancel === 'function') onCancel();
            resolve(isPrompt ? null : false);
        }

        function handleKey(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        }

        if (okBtn) okBtn.onclick = handleConfirm;
        if (cancelBtn) cancelBtn.onclick = handleCancel;
        document.addEventListener('keydown', handleKey);
    });
};

window.showConfirmModal = function(message, title = 'Please Confirm', options = {}) {
    return window.showUiModal({
        title: title,
        message: message,
        isConfirm: true,
        type: options.type || (title.toLowerCase().includes('cancel') || title.toLowerCase().includes('delete') ? 'danger' : 'warning'),
        confirmText: options.confirmText || (title.toLowerCase().includes('cancel') || title.toLowerCase().includes('delete') ? 'Yes, Proceed' : 'Yes, Confirm'),
        cancelText: options.cancelText || 'Cancel',
        onConfirm: options.onConfirm,
        onCancel: options.onCancel
    });
};

window.showPromptModal = function(message, defaultValue = '', title = 'Input Required', options = {}) {
    return window.showUiModal({
        title: title,
        message: message,
        isPrompt: true,
        defaultValue: defaultValue,
        type: 'info',
        confirmText: options.confirmText || 'Submit',
        cancelText: options.cancelText || 'Cancel',
        onConfirm: options.onConfirm,
        onCancel: options.onCancel
    });
};

// Seamlessly route all window.alert calls to the center UI modal!
window.alert = function(msg) {
    window.showUiModal(msg);
};

// Lightweight, non-intrusive floating toast notification
window.showToast = function(msg, type = 'success') {
    if (window.deferDatabaseSuccess?.(msg, type)) return;
    let toast = document.getElementById('uiFloatingToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'uiFloatingToast';
        document.body.appendChild(toast);
    }
    
    const icon = type === 'success' ? 'check-circle' : (type === 'danger' ? 'alert-triangle' : 'info');
    const color = type === 'success' ? '#2ec4b6' : (type === 'danger' ? '#ff6b6b' : 'var(--primary)');
    const border = type === 'success' ? 'rgba(46,196,182,0.4)' : (type === 'danger' ? 'rgba(230,57,70,0.4)' : 'rgba(255,190,11,0.4)');
    
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: rgba(20, 20, 20, 0.95);
        color: #ffffff;
        border: 1px solid ${border};
        box-shadow: 0 12px 36px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5);
        border-radius: 30px;
        padding: 10px 22px;
        font-size: 0.9rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 99999999;
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
    `;
    
    toast.innerHTML = `<span style="color: ${color}; display: flex; align-items: center;"><i data-lucide="${icon}" style="width: 18px; height: 18px;"></i></span> <span>${msg}</span>`;
    if (window.lucide) window.lucide.createIcons();
    
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-15px)';
    }, 2400);
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
    }, 2200);
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only active on Master Orders view
        if (!currentUser || currentView !== 'viewMasterOrders' || typeof e.key !== 'string') return;
        
        // Ignore if user is typing in an input field
        const activeTag = document.activeElement?.tagName?.toLowerCase() || '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
        
        const key = e.key.toLowerCase();
        let newView = null;
        
        switch(key) {

            case 'b': newView = 'brigade'; break;
            case 'v': newView = 'vidyaranyapura'; break;
            case 'm': newView = 'ms-palya'; break;
            case 'y': newView = 'yelahanka'; break;
            case 'c': newView = 'cafe'; break;
        }
        
        if (newView) {
            // Only update if the user has access to this location or it's 'all'
            if (currentUser.role === 'admin' || currentUser.assignedLocations.includes('all') || currentUser.assignedLocations.includes(newView)) {
                currentStoreView = newView;
                loadDashboardData(); // Rebuilds the table, metrics, and dropdown to reflect active state
            }
        }
    });
}
window.loadMasterOrdersData = loadDashboardData;

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
// LOGIN & SESSION MANAGEMENT
// ============================================================
function applyLoggedInUser(user, targetView = null) {
    currentUser = user;
    window.OutletSelection?.restore();
    
    // Populate profile in sidebar
    const nameEl = document.getElementById('userName');
    const titleEl = document.getElementById('userTitle');
    const initialEl = document.getElementById('userInitial');
    if (nameEl) nameEl.textContent = user.name;
    if (titleEl) titleEl.textContent = user.title;
    if (initialEl) initialEl.textContent = user.name ? user.name.charAt(0) : 'U';
    
    // Adjust UI for roles
    const adminEls = document.querySelectorAll('.admin-only');
    const superEls = document.querySelectorAll('.supervisor-only');
    const noChefEls = document.querySelectorAll('.no-chef');
    
    if (user.role === 'admin') {
        adminEls.forEach(el => el.classList.remove('hidden'));
        superEls.forEach(el => el.classList.add('hidden'));
    } else if (user.role === 'supervisor') {
        adminEls.forEach(el => el.classList.add('hidden'));
        superEls.forEach(el => el.classList.remove('hidden'));
    } else {
        adminEls.forEach(el => el.classList.add('hidden'));
        superEls.forEach(el => el.classList.add('hidden'));
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
    
    if (typeof updateRequestsBadge === 'function') updateRequestsBadge();
    if (typeof updateIndentsBadge === 'function') updateIndentsBadge();
    
    // Show dashboard page, hide login page
    const pageLogin = document.getElementById('page-login');
    const pageDashboard = document.getElementById('page-dashboard');
    if (pageLogin) pageLogin.classList.remove('active', 'show');
    if (pageDashboard) pageDashboard.classList.add('active');
    
    
    // Restore preserved or requested view
    const savedView = targetView || localStorage.getItem('nchef_active_view');
    const savedSub = localStorage.getItem('nchef_active_subdivision');
    
    if (user.role === 'chef') {
        window.switchToView('viewChefPortal');
    } else if (user.role === 'admin') {
        if (savedView && savedView !== 'viewRequests' && savedView !== 'viewChefPortal') {
            window.switchToView(savedView, savedSub);
        } else {
            window.switchToView('viewMasterOrders');
        }
    } else {
        // Supervisor or default
        if (savedView && savedView !== 'viewChefPortal' && savedView !== 'viewVendors' && savedView !== 'viewLocations' && savedView !== 'viewUsers') {
            window.switchToView(savedView, savedSub);
        } else {
            window.switchToView('viewMasterOrders');
        }
    }
}
window.applyLoggedInUser = applyLoggedInUser;

function initLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const userIn   = document.getElementById('username');
    const passIn   = document.getElementById('password');
    const errDiv   = document.getElementById('loginError');

    const doLogin = async () => {
        const u = userIn ? userIn.value.trim() : '';
        const p = passIn ? passIn.value : '';
        if (loginBtn) loginBtn.disabled = true;
        try {
            const result = await apiRequest('login', 'POST', { username: u, password: p });
            applyServerState(result.state);
            if (errDiv) errDiv.classList.remove('active');
            if (passIn) passIn.value = '';
            applyLoggedInUser(result.user);
        } catch (error) {
            if (errDiv) { errDiv.textContent = error.message; errDiv.classList.add('active'); }
        } finally {
            if (loginBtn) loginBtn.disabled = false;
        }
    };

    if (loginBtn) loginBtn.addEventListener('click', doLogin);
    if (passIn) passIn.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') doLogin();
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try { await apiRequest('logout', 'POST', {}); } catch (error) { if (error.status !== 401) throw error; }
            committedState = null;
            for (const values of Object.values(collectionMap)) values.length = 0;
            currentUser = null;
            localStorage.removeItem('nchef_logged_in_username');
            localStorage.removeItem('nchef_active_view');
            localStorage.removeItem('nchef_active_subdivision');
            if (userIn) userIn.value = '';
            if (passIn) passIn.value = '';
            const pageDashboard = document.getElementById('page-dashboard');
            const pageLogin = document.getElementById('page-login');
            if (pageDashboard) pageDashboard.classList.remove('active');
            if (pageLogin) pageLogin.classList.add('active', 'show');
        });
    }
    
    const backHomeBtn = document.getElementById('backHomeBtn');
    if (backHomeBtn) {
        backHomeBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    apiRequest('session').then(result => {
        applyServerState(result.state);
        applyLoggedInUser(result.user);
    }).catch(async error => {
        if (error.status !== 401 && errDiv) { errDiv.textContent = error.message; errDiv.classList.add('active'); }
        try {
            const setup = await apiRequest('setup-status');
            if (setup.required && errDiv) {
                errDiv.textContent = 'Administrator setup is required. Open /setup.html to create the first account.';
                errDiv.classList.add('active');
            }
        } catch { /* Keep the connection error visible. */ }
    });
}

// ============================================================
// NAVIGATION & VIEW SWITCHING
// ============================================================
window.switchToView = function(viewName, subDivision = null) {
    const navMaster = document.getElementById('navMasterOrders');
    const navRequests = document.getElementById('navRequests');
    const navManageRequests = document.getElementById('navManageRequests');
    const navConsolidateRequests = document.getElementById('navConsolidateRequests');
    const navRequestsSubmenu = document.getElementById('navRequestsSubmenu');
    const navRequestsChevron = document.getElementById('navRequestsChevron');
    const navIndents = document.getElementById('navIndents');
    const navChef = document.getElementById('navChefPortal');
    const navStock = document.getElementById('navStock');
    const navStockSubmenu = document.getElementById('navStockSubmenu');
    const navStockChevron = document.getElementById('navStockChevron');
    const navAddItems = document.getElementById('navAddItems');
    const navVendors = document.getElementById('navVendors');
    const navLocations = document.getElementById('navLocations');
    const navUsers = document.getElementById('navUsers');
    const navUsersSubmenu = document.getElementById('navUsersSubmenu');
    const navUsersChevron = document.getElementById('navUsersChevron');
    const navSubSupervisors = document.getElementById('navSubSupervisors');
    const navSubChefs = document.getElementById('navSubChefs');
    const navSubAdmins = document.getElementById('navSubAdmins');
    const navAddChef = document.getElementById('navAddChef');

    const viewMaster = document.getElementById('viewMasterOrders');
    const viewRequests = document.getElementById('viewRequests');
    const viewConsolidateRequests = document.getElementById('viewConsolidateRequests');
    const viewIndents = document.getElementById('viewIndents');
    const viewChef = document.getElementById('viewChefPortal');
    const viewVendors = document.getElementById('viewVendors');
    const viewLocations = document.getElementById('viewLocations');
    const viewUsers = document.getElementById('viewUsers');
    const viewAddChef = document.getElementById('viewAddChef');

    document.getElementById("viewInventory")?.classList.add("hidden");
    document.querySelectorAll('[data-inventory]').forEach(a => a.classList.remove('active'));
    // Hide all views & deactivate nav items
    [viewMaster, viewRequests, viewConsolidateRequests, viewIndents, viewChef, viewVendors, viewLocations, viewUsers, viewAddChef].forEach(v => {
        if (v) v.classList.add('hidden');
    });
    [navMaster, navStock, navAddItems, navRequests, navManageRequests, navConsolidateRequests, navIndents, navChef, navVendors, navLocations, navUsers, navSubSupervisors, navSubChefs, navSubAdmins, navAddChef].forEach(n => {
        if (n) n.classList.remove('active');
    });

    if (viewName !== 'viewRequests' && viewName !== 'viewConsolidateRequests') {
        if (navRequestsSubmenu) navRequestsSubmenu.classList.remove('open');
        if (navRequestsChevron) navRequestsChevron.style.transform = 'rotate(0deg)';
    }
    if (viewName !== 'viewUsers') {
        if (navUsersSubmenu) navUsersSubmenu.classList.remove('open');
        if (navUsersChevron) navUsersChevron.style.transform = 'rotate(0deg)';
    }
    if (viewName !== 'viewMasterOrders') {
        if (navStockSubmenu) navStockSubmenu.classList.remove('open');
        if (navStockChevron) navStockChevron.style.transform = 'rotate(0deg)';
    }

    currentView = viewName;
    localStorage.setItem('nchef_active_view', viewName);

    // Sync mobile active page indicator and auto-close mobile navigation drawer
    const mobilePageTitles = {
        viewMasterOrders: 'Master Orders',
        viewRequests: 'Manage Requests',
        viewConsolidateRequests: 'Consolidate Request',
        viewIndents: 'Indents',
        viewChefPortal: 'My Requests',
        viewVendors: 'Vendors',
        viewLocations: 'Locations',
        viewUsers: 'Users',
        viewAddChef: 'Add Chef'
    };
    const mobileActiveTitleEl = document.getElementById('mobileActivePage');
    if (mobileActiveTitleEl) {
        mobileActiveTitleEl.textContent = mobilePageTitles[viewName] || 'Dashboard';
    }
    const mobileDrawer = document.getElementById('appSidebar');
    const mobileBackdrop = document.getElementById('mobileDrawerBackdrop');
    if (mobileDrawer) mobileDrawer.classList.remove('mobile-open');
    if (mobileBackdrop) mobileBackdrop.classList.add('hidden');

    if (window.showInventoryView?.(viewName)) return;
    switch(viewName) {
        case 'viewMasterOrders':
            if (viewMaster) viewMaster.classList.remove('hidden');
            if (navMaster) navMaster.classList.add('active');
            loadDashboardData();
            break;
            
        case 'viewRequests':
            if (viewRequests) viewRequests.classList.remove('hidden');
            if (navRequests) navRequests.classList.add('active');
            if (navManageRequests) navManageRequests.classList.add('active');
            if (navRequestsSubmenu) navRequestsSubmenu.classList.add('open');
            if (navRequestsChevron) navRequestsChevron.style.transform = 'rotate(180deg)';
            loadRequestsData();
            break;

        case 'viewConsolidateRequests':
            if (viewConsolidateRequests) viewConsolidateRequests.classList.remove('hidden');
            if (navRequests) navRequests.classList.add('active');
            if (navConsolidateRequests) navConsolidateRequests.classList.add('active');
            if (navRequestsSubmenu) navRequestsSubmenu.classList.add('open');
            if (navRequestsChevron) navRequestsChevron.style.transform = 'rotate(180deg)';
            if (typeof loadConsolidateWorkspace === 'function') loadConsolidateWorkspace();
            break;

        case 'viewIndents':
            if (viewIndents) viewIndents.classList.remove('hidden');
            if (navIndents) navIndents.classList.add('active');
            loadIndentsData();
            renderVendorPOTable();
            break;

        case 'viewChefPortal':
            if (viewChef) viewChef.classList.remove('hidden');
            if (navChef) navChef.classList.add('active');
            loadChefPortalData();
            break;

        case 'viewVendors':
            if (viewVendors) viewVendors.classList.remove('hidden');
            if (navVendors) navVendors.classList.add('active');
            loadVendorsData();
            break;

        case 'viewLocations':
            if (viewLocations) viewLocations.classList.remove('hidden');
            if (navLocations) navLocations.classList.add('active');
            loadLocationsData();
            break;

        case 'viewUsers':
            if (viewUsers) viewUsers.classList.remove('hidden');
            if (navUsers) navUsers.classList.add('active');
            if (navUsersSubmenu) navUsersSubmenu.classList.add('open');
            if (navUsersChevron) navUsersChevron.style.transform = 'rotate(180deg)';
            const sub = subDivision || currentUserSubdivision || 'supervisor';
            if (typeof switchUserSubdivision === 'function') {
                switchUserSubdivision(sub);
            } else {
                loadUsersData();
            }
            localStorage.setItem('nchef_active_subdivision', sub);
            break;

        case 'viewAddChef':
            if (viewAddChef) viewAddChef.classList.remove('hidden');
            if (navAddChef) navAddChef.classList.add('active');
            if (typeof loadAddChefView === 'function') loadAddChefView();
            break;

        default:
            if (viewMaster) viewMaster.classList.remove('hidden');
            if (navMaster) navMaster.classList.add('active');
            loadDashboardData();
            break;
    }
};

function initNavigation() {
    const navMaster = document.getElementById('navMasterOrders');
    const navRequests = document.getElementById('navRequests');
    const navManageRequests = document.getElementById('navManageRequests');
    const navConsolidateRequests = document.getElementById('navConsolidateRequests');
    const navRequestsSubmenu = document.getElementById('navRequestsSubmenu');
    const navRequestsChevron = document.getElementById('navRequestsChevron');
    const navIndents = document.getElementById('navIndents');
    const navChef = document.getElementById('navChefPortal');
    const navStock = document.getElementById('navStock');
    const navStockSubmenu = document.getElementById('navStockSubmenu');
    const navStockChevron = document.getElementById('navStockChevron');
    const navVendors = document.getElementById('navVendors');
    const navLocations = document.getElementById('navLocations');
    const navUsers = document.getElementById('navUsers');
    const navUsersSubmenu = document.getElementById('navUsersSubmenu');
    const navUsersChevron = document.getElementById('navUsersChevron');
    const navSubSupervisors = document.getElementById('navSubSupervisors');
    const navSubChefs = document.getElementById('navSubChefs');
    const navSubAdmins = document.getElementById('navSubAdmins');
    const navAddChef = document.getElementById('navAddChef');

    if (navMaster) {
        navMaster.addEventListener('click', (e) => {
            e.preventDefault();
            window.switchToView('viewMasterOrders');
        });
    }

    if (navStock) {
        navStock.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = navStockSubmenu && navStockSubmenu.classList.contains('open');
            if (isOpen) {
                navStockSubmenu.classList.remove('open');
                if (navStockChevron) navStockChevron.style.transform = 'rotate(0deg)';
                navStock.classList.remove('active');
            } else {
                if (navStockSubmenu) navStockSubmenu.classList.add('open');
                if (navStockChevron) navStockChevron.style.transform = 'rotate(180deg)';
                navStock.classList.add('active');
            }
        });
    }

    if (navRequests) {
        navRequests.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = navRequestsSubmenu && navRequestsSubmenu.classList.contains('open');
            if (isOpen && (currentView === 'viewRequests' || currentView === 'viewConsolidateRequests')) {
                navRequestsSubmenu.classList.remove('open');
                if (navRequestsChevron) navRequestsChevron.style.transform = 'rotate(0deg)';
            } else {
                window.switchToView('viewRequests');
            }
        });
    }

    if (navManageRequests) {
        navManageRequests.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.switchToView('viewRequests');
        });
    }

    if (navConsolidateRequests) {
        navConsolidateRequests.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.switchToView('viewConsolidateRequests');
        });
    }

    if (navIndents) {
        navIndents.addEventListener('click', (e) => {
            e.preventDefault();
            window.switchToView('viewIndents');
        });
    }

    if (navChef) {
        navChef.addEventListener('click', (e) => {
            e.preventDefault();
            window.switchToView('viewChefPortal');
        });
    }

    if (navVendors) {
        navVendors.addEventListener('click', (e) => {
            e.preventDefault();
            window.switchToView('viewVendors');
        });
    }

    if (navLocations) {
        navLocations.addEventListener('click', (e) => {
            e.preventDefault();
            window.switchToView('viewLocations');
        });
    }

    if (navUsers) {
        navUsers.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = navUsersSubmenu && navUsersSubmenu.classList.contains('open');
            if (isOpen && currentView === 'viewUsers') {
                navUsersSubmenu.classList.remove('open');
                if (navUsersChevron) navUsersChevron.style.transform = 'rotate(0deg)';
            } else {
                window.switchToView('viewUsers', 'supervisor');
            }
        });
    }

    if (navSubSupervisors) {
        navSubSupervisors.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.switchToView('viewUsers', 'supervisor');
        });
    }

    if (navSubChefs) {
        navSubChefs.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.switchToView('viewUsers', 'chef');
        });
    }

    if (navSubAdmins) {
        navSubAdmins.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.switchToView('viewUsers', 'admin');
        });
    }

    if (navAddChef) {
        navAddChef.addEventListener('click', (e) => {
            e.preventDefault();
            window.switchToView('viewAddChef');
        });
    }

    // Desktop Sidebar Collapse Toggle
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    const dashboardLayout = document.getElementById('page-dashboard');
    const isSidebarCollapsed = localStorage.getItem('nchef_sidebar_collapsed') === 'true';
    if (isSidebarCollapsed && dashboardLayout) {
        dashboardLayout.classList.add('sidebar-collapsed');
    }

    const syncSidebarToggle = () => {
        if (!sidebarCollapseBtn || !dashboardLayout) return;
        const collapsed = dashboardLayout.classList.contains('sidebar-collapsed');
        sidebarCollapseBtn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar (Compact View)';
        sidebarCollapseBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        sidebarCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
        const icon = document.getElementById('sidebarCollapseIcon');
        if (icon) {
            icon.setAttribute('data-lucide', collapsed ? 'chevron-right' : 'chevron-left');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    };
    syncSidebarToggle();
    if (sidebarCollapseBtn && dashboardLayout) {
        sidebarCollapseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dashboardLayout.classList.toggle('sidebar-collapsed');
            const collapsed = dashboardLayout.classList.contains('sidebar-collapsed');
            localStorage.setItem('nchef_sidebar_collapsed', collapsed ? 'true' : 'false');
            syncSidebarToggle();
        });
    }

    // Desktop Display Scale (Percentage / Density) Controller
    const densityBtn = document.getElementById('uiDensityBtn');
    const densityLabel = document.getElementById('uiDensityLabel');
    const scales = ['100%', '85%', '75%'];
    const scaleValues = { '100%': '1', '85%': '0.85', '75%': '0.75' };

    let currentScale = localStorage.getItem('nchef_ui_scale') || '100%';
    if (!scales.includes(currentScale)) currentScale = '100%';

    const applyScale = (s) => {
        currentScale = s;
        localStorage.setItem('nchef_ui_scale', s);
        const scaleVal = scaleValues[s] || '1';
        if (dashboardLayout) {
            if (window.innerWidth > 1024) {
                dashboardLayout.style.zoom = scaleVal;
                dashboardLayout.style.setProperty('--ui-scale', scaleVal);
            } else {
                dashboardLayout.style.zoom = '1';
                dashboardLayout.style.setProperty('--ui-scale', '1');
            }
        }
        if (densityLabel) densityLabel.textContent = s;
        if (densityBtn) densityBtn.title = `Display Scale: ${s} (Click to switch: 100% / 85% / 75%)`;
    };

    applyScale(currentScale);

    if (densityBtn) {
        densityBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const nextIdx = (scales.indexOf(currentScale) + 1) % scales.length;
            applyScale(scales[nextIdx]);
        });
    }

    window.addEventListener('resize', () => {
        if (!dashboardLayout) return;
        if (window.innerWidth <= 1024) {
            dashboardLayout.style.zoom = '1';
            dashboardLayout.style.setProperty('--ui-scale', '1');
        } else {
            const scaleVal = scaleValues[currentScale] || '1';
            dashboardLayout.style.zoom = scaleVal;
            dashboardLayout.style.setProperty('--ui-scale', scaleVal);
        }
    });

    // Mobile Menu Toggle and Drawer
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileDrawerCloseBtn = document.getElementById('mobileDrawerCloseBtn');
    const mobileDrawerBackdrop = document.getElementById('mobileDrawerBackdrop');
    const appSidebar = document.getElementById('appSidebar') || document.querySelector('.sidebar');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    const openMobileDrawer = (e) => {
        if (e) e.preventDefault();
        if (appSidebar) appSidebar.classList.add('mobile-open');
        if (mobileDrawerBackdrop) mobileDrawerBackdrop.classList.remove('hidden');
    };

    const closeMobileDrawer = (e) => {
        if (e) e.preventDefault();
        if (appSidebar) appSidebar.classList.remove('mobile-open');
        if (mobileDrawerBackdrop) mobileDrawerBackdrop.classList.add('hidden');
    };

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileDrawer);
    if (mobileDrawerCloseBtn) mobileDrawerCloseBtn.addEventListener('click', closeMobileDrawer);
    if (mobileDrawerBackdrop) mobileDrawerBackdrop.addEventListener('click', closeMobileDrawer);

    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.click();
        });
    }
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
    // Do not invent permissions when an account has no visible outlet.
    return [];
}

// Helper to get or infer item cuisine
function getItemCuisine(item, outletId) {
    if (!item) return 'Indian';
    if (item.cuisine && typeof item.cuisine === 'string' && item.cuisine.trim()) {
        return item.cuisine.trim();
    }
    if (typeof requestsData !== 'undefined' && Array.isArray(requestsData)) {
        if (outletId && outletId !== 'all') {
            const req = requestsData.find(r => (r.itemId === item.id || r.itemName === item.name) && r.outletId === outletId && r.cuisine);
            if (req && req.cuisine) {
                item.cuisine = req.cuisine;
                return req.cuisine;
            }
        }
        const reqAny = requestsData.find(r => (r.itemId === item.id || r.itemName === item.name) && r.cuisine);
        if (reqAny && reqAny.cuisine) {
            item.cuisine = reqAny.cuisine;
            return reqAny.cuisine;
        }
    }
    const defaultItemCuisines = {
        'item_01': 'Continental',
        'item_02': 'Continental',
        'item_03': 'Indian',
        'item_04': 'Continental',
        'item_05': 'Kerala',
        'item_06': 'Continental',
        'item_07': 'Tandoor',
        'item_08': 'Kerala',
        'item_09': 'Arabic',
        'item_10': 'Indian'
    };
    if (item.id && defaultItemCuisines[item.id]) {
        item.cuisine = defaultItemCuisines[item.id];
        return defaultItemCuisines[item.id];
    }
    const name = (item.name || '').toLowerCase();
    if (name.includes('chicken') || name.includes('tandoor') || name.includes('tikka')) item.cuisine = 'Tandoor';
    else if (name.includes('pasta') || name.includes('tuna') || name.includes('bread') || name.includes('cheese')) item.cuisine = 'Continental';
    else if (name.includes('noodle') || name.includes('soya') || name.includes('chilli')) item.cuisine = 'Chinese';
    else if (name.includes('rice') || name.includes('tomato') || name.includes('coconut')) item.cuisine = 'Kerala';
    else if (name.includes('coffee') || name.includes('shawarma') || name.includes('pita')) item.cuisine = 'Arabic';
    else item.cuisine = 'Indian';
    return item.cuisine;
}

// Sync and handle inline Cuisine Filter dropdown
function updateCuisineFilterSelect() {
    const select = document.getElementById('cuisineFilterSelect');
    if (!select) return;

    select.value = currentCuisineFilter;
    if (currentCuisineFilter !== 'all') {
        select.classList.add('active');
    } else {
        select.classList.remove('active');
    }

    if (!select.dataset.bound) {
        select.addEventListener('change', (e) => {
            currentCuisineFilter = e.target.value;
            loadDashboardData();
        });
        select.dataset.bound = 'true';
    }
}

function loadDashboardData() {
    if (!currentUser) return;
    window.renderOutletDashboard?.();
    updateFormSelects(getVisibleOutlets());
}

function initForms() {
    initCustomDatePicker();


    const allocBtn = document.getElementById('allocateBtn');
    if (allocBtn) {
        allocBtn.addEventListener('click', async () => {
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
            await saveData();
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
}
    
    const reqBtn = document.getElementById('requestBtn');
    if (reqBtn) {
        reqBtn.addEventListener('click', async () => {
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
            
            await saveData();
            document.getElementById('reqQty').value = '';
            alert("Request submitted successfully!");
            updateRequestsBadge();
        });
    }
    
    const clearAllRequestsBtn = document.getElementById('clearAllRequestsBtn');
    if (clearAllRequestsBtn) {
        clearAllRequestsBtn.addEventListener('click', async () => {
            const confirmed = await window.showConfirmModal("Are you sure you want to clear all requests and supervisor indents? This action cannot be undone.", "Clear All Requests", {
                type: 'danger',
                confirmText: 'Clear All'
            });
            if (confirmed) {
                if (currentUser.role === 'admin') {
                    requestsData.length = 0;
                    indentsData.length = 0;
                } else {
                    const currentUserName = currentUser.name;
                    for (let i = requestsData.length - 1; i >= 0; i--) {
                        if (requestsData[i].requestedBy === currentUserName || requestsData[i].chefName === currentUserName) {
                            requestsData.splice(i, 1);
                        }
                    }
                    for (let i = indentsData.length - 1; i >= 0; i--) {
                        if (indentsData[i].supervisorName === currentUserName) {
                            indentsData.splice(i, 1);
                        }
                    }
                }
                await saveData();
                loadRequestsData();
                loadIndentsData();
                updateRequestsBadge();
                updateIndentsBadge();
                if (typeof loadChefPortalData === 'function') loadChefPortalData();
                window.showToast("All requests cleared successfully", 'info');
            }
        });
    }
    
    const addVendorBtn = document.getElementById('addVendorBtn');
    if (addVendorBtn) {
        addVendorBtn.addEventListener('click', async () => {
            const editId = document.getElementById('editVendorId')?.value;
            const name = document.getElementById('newVendorName')?.value.trim();
            if (!name) {
                window.showToast("Please enter a vendor name.", "warning");
                return;
            }
            if (editId) {
                const v = vendorsData.find(vend => vend.id === editId);
                if (v) {
                    v.name = name;
                    window.showToast(`Vendor ${name} updated successfully!`, "success");
                }
            } else {
                vendorsData.push({ id: 'v_' + Date.now(), name });
                window.showToast(`Vendor ${name} registered successfully!`, "success");
            }
            await saveData();
            if (typeof resetVendorForm === 'function') resetVendorForm();
            loadVendorsData();
            updateFormSelects(getVisibleOutlets()); // Refresh vendor dropdowns
        });
    }

    const cancelEditVendorBtn = document.getElementById('cancelEditVendorBtn');
    if (cancelEditVendorBtn) {
        cancelEditVendorBtn.addEventListener('click', () => {
            if (typeof resetVendorForm === 'function') resetVendorForm();
        });
    }
    
    const saveUserBtn = document.getElementById('saveUserBtn');
    if(saveUserBtn) {
        saveUserBtn.addEventListener('click', () => window.saveUser());
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

    document.getElementById('btnApproveIndent')?.addEventListener('click', async () => {
        const indent = indentsData.find(i => i.id === activeReviewingIndentId);
        if (indent) {
            await runDatabaseAction('indents/approve', { indentId: indent.id });
            document.getElementById('modalIndentApproval')?.classList.add('hidden');
            window.showUiModal({
                title: "Request Approved",
                message: `Consolidated Request ${indent.indentNumber || indent.id} approved successfully! Stock has been allocated to ${indent.outletName}.`,
                type: "success"
            });
            loadRequestsData();
            loadIndentsData();
            loadDashboardData();
        }
    });

    document.getElementById('btnRejectIndent')?.addEventListener('click', async () => {
        const indent = indentsData.find(i => i.id === activeReviewingIndentId);
        if (indent) {
            const reason = await window.showPromptModal("Enter reason for rejection:", "Insufficient stock / revised plan", "Reject Request");
            if (reason !== null && reason !== false) {
                indent.status = 'Rejected';
                indent.rejectReason = reason;
                // Linked requests become rejected as well
                requestsData.forEach(r => {
                    if (r.indentId === indent.id) {
                        r.status = 'Rejected';
                    }
                });
                await saveData();
                document.getElementById('modalIndentApproval')?.classList.add('hidden');
                window.showUiModal({
                    title: "Request Rejected",
                    message: `Consolidated Request ${indent.indentNumber || indent.id} has been rejected.`,
                    type: "warning"
                });
                loadRequestsData();
                loadIndentsData();
            }
        }
    });

    // Raise to Vendor PO Modal Handlers
    document.getElementById('btnRaiseVendorPO')?.addEventListener('click', () => {
        if (typeof openVendorPOModal === 'function') openVendorPOModal();
    });

    document.getElementById('closeVendorPOModalBtn')?.addEventListener('click', () => {
        document.getElementById('modalVendorPO')?.classList.add('hidden');
    });

    document.getElementById('poModalCancelBtn')?.addEventListener('click', () => {
        document.getElementById('modalVendorPO')?.classList.add('hidden');
    });

    document.getElementById('btnConfirmSendPO')?.addEventListener('click', () => {
        if (typeof submitVendorPurchaseOrder === 'function') submitVendorPurchaseOrder();
    });

    // Add Chef Handlers
    document.getElementById('btnSaveChefSubmit')?.addEventListener('click', () => {
        if (typeof saveChefUser === 'function') saveChefUser();
    });
    document.getElementById('btnCancelEditChef')?.addEventListener('click', () => {
        if (typeof resetChefForm === 'function') resetChefForm();
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
    
    const itemsOptions = '<option value="" disabled selected>Select Item</option>' + masterItemsData.filter(i => i.active !== false).map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    
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
    
    window.OutletSelection?.renderHeader();
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
    const pendingCount = allChefReqs.filter(r => r.status === 'Pending' || r.status === 'Accepted' || r.status === 'Sent to Admin').length;
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
            const dateStr = (r.timestamp || r.date) ? InventoryTools.timestamp(r.timestamp || r.date) : '-';
            let statusHtml = '';
            if (r.status === 'Pending') {
                statusHtml = `<span class="status pending" style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pending Supervisor</span>`;
            } else if (r.status === 'Accepted') {
                statusHtml = `<span class="status ok" style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Accepted by Supervisor</span>`;
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
            
            const actionHtml = (r.status === 'Pending' || r.status === 'Accepted') 
                ? `<button class="btn btn-outline" style="padding: 3px 9px; font-size: 0.72rem; border-color: rgba(230,57,70,0.4); color: #ff6b6b; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" onclick="deleteChefRequest('${r.id}')" title="Cancel this request">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Cancel
                   </button>`
                : `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
            
            return `
                <tr id="chefReqRow_${r.id}">
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

window.deleteChefRequest = async function(reqId) {
    const req = requestsData.find(r => String(r.id) === String(reqId));
    if (!req || (req.status !== 'Pending' && req.status !== 'Accepted')) return;
    
    const confirmed = await window.showConfirmModal(
        `Are you sure you want to cancel the request for "${req.itemName}" (${req.qty} ${req.unit || 'kg'})?`,
        "Cancel Request",
        {
            type: 'danger',
            confirmText: 'Yes, Cancel Request',
            cancelText: 'Keep Request'
        }
    );
    
    if (confirmed) {
        const rowEl = document.getElementById(`chefReqRow_${reqId}`);
        if (rowEl) {
            rowEl.style.transition = 'all 0.2s ease';
            rowEl.style.opacity = '0';
            rowEl.style.transform = 'scale(0.96)';
        }
        const reqIndex = requestsData.findIndex(r => String(r.id) === String(reqId));
        if (reqIndex !== -1) {
            const itemName = requestsData[reqIndex].itemName;
            requestsData.splice(reqIndex, 1);
            await saveData();
            loadChefPortalData();
            if (typeof loadRequestsData === 'function') loadRequestsData();
            if (typeof updateRequestsBadge === 'function') updateRequestsBadge();
            window.showToast(`Cancelled request for ${itemName}`, 'info');
        }
    }
};

// Store inventory removed per user request
function loadStoreInventoryData() {}

// ============================================================
// ADMIN VIEWS
// ============================================================
window.deleteItem = async function(itemId) {
    const item = masterItemsData.find(i => String(i.id) === String(itemId));
    const itemName = item ? item.name : 'this item';
    
    const confirmed = await window.showConfirmModal(
        `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
        "Delete Item",
        {
            type: 'danger',
            confirmText: 'Yes, Delete'
        }
    );
    
    if (confirmed) {
        const itemIndex = masterItemsData.findIndex(i => String(i.id) === String(itemId));
        if (itemIndex > -1) {
            masterItemsData.splice(itemIndex, 1);
            await saveData();
            loadDashboardData();
            window.showToast(`Deleted ${itemName}`, 'info');
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
            if (r.status !== 'Pending' && r.status !== 'Accepted') return false;
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
        headerTitle.innerHTML = `Outlet <span class="text-primary">Requests</span>`;
        headerSub.textContent = `Review requests for your allocated outlet and accept items to consolidate.`;
    } else {
        headerTitle.innerHTML = `My <span class="text-primary">Requests</span>`;
        headerSub.textContent = `Track the status of your stock requests.`;
    }
    
    // View switcher tab listeners
    const btnSupMode = document.getElementById('btnViewModeSupervisorRequests');
    const btnSecMode = document.getElementById('btnViewModeSections');
    const btnListMode = document.getElementById('btnViewModeList');
    const containerSup = document.getElementById('containerSupervisorRequestsView');
    const containerSec = document.getElementById('containerSectionsView');
    const containerList = document.getElementById('containerListView');
    
    window.switchRequestsTab = function(mode) {
        if (currentUser.role !== 'admin' && mode === 'supervisor') {
            mode = 'sections';
        }
        window._activeRequestsTab = mode;
        if (btnSupMode) {
            btnSupMode.className = (mode === 'supervisor') ? 'btn btn-primary admin-only' : 'btn btn-outline admin-only';
            if (currentUser.role !== 'admin') btnSupMode.classList.add('hidden');
        }
        if (btnSecMode) btnSecMode.className = (mode === 'sections') ? 'btn btn-primary' : 'btn btn-outline';
        if (btnListMode) btnListMode.className = (mode === 'list') ? 'btn btn-primary' : 'btn btn-outline';

        if (containerSup) {
            if (mode === 'supervisor' && currentUser.role === 'admin') containerSup.classList.remove('hidden');
            else containerSup.classList.add('hidden');
        }
        if (containerSec) {
            if (mode === 'sections') containerSec.classList.remove('hidden');
            else containerSec.classList.add('hidden');
        }
        if (containerList) {
            if (mode === 'list') containerList.classList.remove('hidden');
            else containerList.classList.add('hidden');
        }
    };

    if (btnSupMode && !btnSupMode.dataset.bound) {
        btnSupMode.addEventListener('click', () => window.switchRequestsTab('supervisor'));
        btnSupMode.dataset.bound = 'true';
    }
    if (btnSecMode && !btnSecMode.dataset.bound) {
        btnSecMode.addEventListener('click', () => window.switchRequestsTab('sections'));
        btnSecMode.dataset.bound = 'true';
    }
    if (btnListMode && !btnListMode.dataset.bound) {
        btnListMode.addEventListener('click', () => window.switchRequestsTab('list'));
        btnListMode.dataset.bound = 'true';
    }

    if (currentUser.role === 'supervisor') {
        window._activeRequestsTab = 'sections';
        if (btnSupMode) btnSupMode.classList.add('hidden');
    } else if (currentUser.role === 'admin') {
        if (!window._activeRequestsTab) {
            window._activeRequestsTab = 'supervisor';
        }
        if (btnSupMode) btnSupMode.classList.remove('hidden');
    }
    window.switchRequestsTab(window._activeRequestsTab);
    
    // Admin header action buttons setup
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
            const reqDateStr = InventoryTools.day(r.timestamp || r.date);
            return reqDateStr === selDate;
        });
    }

    // -------------------------------------------------------------
    // 0. RENDER SUPERVISOR CONSOLIDATED REQUESTS TABLE (Admin / Supervisor)
    // -------------------------------------------------------------
    const pendingSupervisorReqs = indentsData.filter(ind => ind.status === 'Pending Approval');
    const pendingBadge = document.getElementById('adminPendingSupervisorBadge');
    if (pendingBadge) {
        if (pendingSupervisorReqs.length > 0) {
            pendingBadge.textContent = pendingSupervisorReqs.length;
            pendingBadge.classList.remove('hidden');
        } else {
            pendingBadge.classList.add('hidden');
        }
    }

    const supTbody = document.getElementById('supervisorRequestsTableBody');
    if (supTbody) {
        let viewableIndents = [...indentsData];
        if (currentUser.role === 'supervisor') {
            const vis = getVisibleOutlets().map(o => o.id);
            if (vis.length > 0) {
                viewableIndents = viewableIndents.filter(ind => vis.includes(ind.outletId));
            }
        }
        if (selOutlet !== 'all') {
            viewableIndents = viewableIndents.filter(ind => ind.outletId === selOutlet);
        }
        if (selStatus !== 'all') {
            if (selStatus === 'Pending') {
                viewableIndents = viewableIndents.filter(ind => ind.status === 'Pending Approval');
            } else {
                viewableIndents = viewableIndents.filter(ind => (ind.status || '').toLowerCase().includes(selStatus.toLowerCase()));
            }
        }
        if (selDate) {
            viewableIndents = viewableIndents.filter(ind => {
                const indKey = typeof getIndentDateKey === 'function' ? getIndentDateKey(ind) : '';
                return indKey === selDate || (ind.date && ind.date.includes(selDate));
            });
        }

        if (viewableIndents.length === 0) {
            supTbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 36px 20px;">
                        <div style="font-size: 2.2rem; margin-bottom: 8px;">📬</div>
                        <div style="font-size: 1.05rem; font-weight: 600; color: var(--text-main);">No Supervisor Requests Found</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Consolidated requests submitted by supervisors will appear here for Admin review, stock allocation, or vendor purchase order placement.</p>
                    </td>
                </tr>
            `;
        } else {
            supTbody.innerHTML = viewableIndents.map(indent => {
                const totalUnits = (indent.items || []).reduce((sum, item) => sum + (Number(item.revisedQty ?? item.originalQty) || 0), 0);
                const itemsCount = (indent.items || []).length;
                const topItems = (indent.items || []).slice(0, 3).map(it => it.itemName).join(', ');
                const moreItems = itemsCount > 3 ? ` +${itemsCount - 3} more` : '';

                let statusBadge = '';
                if (indent.status === 'Pending Approval') {
                    statusBadge = `<span class="status pending" style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); font-weight: 600; padding: 4px 10px; border-radius: 6px;">Pending Admin Approval</span>`;
                } else if (indent.status === 'Approved') {
                    statusBadge = `<span class="status ok" style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); font-weight: 600; padding: 4px 10px; border-radius: 6px;">Approved & Allocated</span>`;
                } else if (indent.status && indent.status.startsWith('PO Raised')) {
                    statusBadge = `<span class="status" style="background: rgba(67, 97, 238, 0.15); color: #4895ef; border: 1px solid rgba(67, 97, 238, 0.35); font-weight: 600; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="truck" style="width: 12px; height: 12px;"></i> ${indent.status}</span>`;
                } else {
                    statusBadge = `<span class="status low" style="padding: 4px 10px; border-radius: 6px;">${indent.status}</span>`;
                }

                let actionBtn = '';
                const deleteBtnHtml = (currentUser.role === 'admin' || currentUser.name === indent.supervisorName)
                    ? `<button class="icon-btn text-danger" onclick="deleteSupervisorRequest('${indent.id}')" title="Delete this request" style="padding: 6px;"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>`
                    : '';

                if (currentUser.role === 'admin') {
                    if (indent.status === 'Pending Approval') {
                        actionBtn = `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                            <button class="btn btn-primary" onclick="openIndentApprovalModal('${indent.id}')" style="padding: 6px 14px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
                                <i data-lucide="check-square" style="width: 14px; height: 14px;"></i> Review & Action
                            </button>
                            ${deleteBtnHtml}
                        </div>`;
                    } else {
                        actionBtn = `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                            <button class="btn btn-outline" onclick="openIndentApprovalModal('${indent.id}')" style="padding: 6px 14px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px;">
                                <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View Details
                            </button>
                            ${deleteBtnHtml}
                        </div>`;
                    }
                } else {
                    actionBtn = `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                        <button class="btn btn-outline" onclick="openIndentApprovalModal('${indent.id}')" style="padding: 6px 14px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px;">
                            <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View Details
                        </button>
                        ${deleteBtnHtml}
                    </div>`;
                }

                const displayDate = typeof formatIndentTableDate === 'function' ? formatIndentTableDate(indent) : (indent.date || '-');

                return `
                    <tr>
                        <td><strong style="color: var(--primary); font-family: monospace; font-size: 0.95rem;">${indent.indentNumber || indent.id}</strong></td>
                        <td>${displayDate}</td>
                        <td><span style="background: rgba(255,190,11,0.1); color: var(--primary); padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">${indent.outletName || 'Outlet'}</span></td>
                        <td><strong>${indent.supervisorName || 'Supervisor'}</strong></td>
                        <td>
                            <div><strong style="color: var(--text-main);">${itemsCount} ingredients</strong></div>
                            <div style="font-size: 0.74rem; color: var(--text-muted); max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${(indent.items || []).map(i => i.itemName).join(', ')}">
                                ${topItems}${moreItems}
                            </div>
                        </td>
                        <td><strong style="font-size: 0.95rem;">${totalUnits.toFixed(1)}</strong></td>
                        <td>${statusBadge}</td>
                        <td style="text-align: right;">${actionBtn}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // -------------------------------------------------------------
    // 1. RENDER KITCHEN SECTIONS TABLE (Grouped by Cuisine Section)
    // -------------------------------------------------------------
    if (containerSec) {
        // Filter viewableRequests for ongoing flow in Kitchen Sections Table:
        // 1. Remove 'General' section completely (requests without valid cuisine or marked 'General' are ignored)
        // 2. Focus strictly on ongoing flow: Pending, Accepted, and Sent to Admin
        const ongoingSectionRequests = viewableRequests.filter(r => {
            if (!r.cuisine || r.cuisine.toLowerCase() === 'general') return false;
            if (selStatus === 'all') {
                return r.status === 'Pending' || r.status === 'Accepted' || r.status === 'Sent to Admin';
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
                const pendingInSec = reqs.filter(r => r.status === 'Pending').length;

                const rowsHtml = reqs.map(r => {
                    const item = masterItemsData.find(i => i.id === r.itemId) || { name: r.itemName || 'Item', unit: r.unit || 'kg' };
                    const dateStr = (r.timestamp || r.date) ? InventoryTools.timestamp(r.timestamp || r.date) : '-';
                    const outletName = r.outletName || (outletsData.find(o => o.id === r.outletId)?.name) || 'Branch';
                    
                    const parentIndent = r.indentId ? indentsData.find(i => i.id === r.indentId) : null;
                    const indentNum = parentIndent ? (parentIndent.indentNumber || parentIndent.id) : null;

                    let statusBadge = '';
                    if (r.status === 'Pending') {
                        statusBadge = `<span class="status pending" style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pending Supervisor</span>`;
                    } else if (r.status === 'Accepted') {
                        statusBadge = `<span class="status ok" style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.35); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">✓ Accepted</span>`;
                    } else if (r.status === 'Sent to Admin' || r.status === 'Consolidated') {
                        statusBadge = `<span class="status" style="background: rgba(67,97,238,0.15); color: #4895ef; border: 1px solid rgba(67,97,238,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Sent to Admin</span>`;
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
                                        <i data-lucide="file-text" style="width:11px; height:11px;"></i> Review Request
                                    </button>
                                `;
                            } else {
                                actionHtml = `<span style="font-size: 0.75rem; color: #4895ef; font-weight: 500;">Awaiting Admin Approval</span>`;
                            }
                        } else if (r.status === 'Pending' || r.status === 'Accepted') {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Awaiting Supervisor</span>`;
                        } else if (r.status === 'Approved') {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">✓ Approved</span>`;
                        } else {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
                        }
                    } else if (currentUser.role === 'supervisor') {
                        if (r.status === 'Pending') {
                            actionHtml = `
                                <button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #2ec4b6, #208b82); border: none; color: white; font-weight: 600; border-radius: 6px; box-shadow: 0 2px 8px rgba(46,196,182,0.3); cursor: pointer;" onclick="acceptChefRequest('${r.id}')" title="Accept this request from Chef">
                                    <i data-lucide="check" style="width:12px; height:12px;"></i> Accept
                                </button>
                                <button class="btn btn-outline" style="padding: 3px 7px; font-size: 0.72rem; border-color: var(--danger); color: var(--danger); border-radius: 6px;" onclick="deleteRequest('${r.id}')" title="Delete item">
                                    <i data-lucide="trash-2" style="width:11px; height:11px;"></i>
                                </button>
                            `;
                        } else if (r.status === 'Accepted') {
                            actionHtml = `
                                <span style="font-size: 0.75rem; color: #2ec4b6; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                                    <i data-lucide="boxes" style="width: 12px; height: 12px;"></i> Ready to Consolidate
                                </span>
                                <button class="btn btn-outline" style="padding: 2px 6px; font-size: 0.68rem; margin-left: 6px; color: var(--text-muted); border-radius: 4px;" onclick="revertChefRequest('${r.id}')" title="Revert to Pending">Undo</button>
                            `;
                        } else if (r.status === 'Sent to Admin' || r.status === 'Consolidated') {
                            actionHtml = `<span style="font-size: 0.75rem; color: #4895ef; font-weight: 500;">Awaiting Admin Approval</span>`;
                        } else if (r.status === 'Approved') {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">✓ Approved</span>`;
                        } else {
                            actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
                        }
                    } else {
                        actionHtml = `<span style="font-size: 0.75rem; color: var(--text-muted);">-</span>`;
                    }

                    // Editable quantity input for supervisor
                    const qtyDisplay = (currentUser.role === 'supervisor' && (r.status === 'Pending' || r.status === 'Accepted'))
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

                const acceptSectionBtnHtml = (currentUser.role === 'supervisor' && pendingInSec > 0)
                    ? `<button class="btn btn-outline" style="font-size: 0.74rem; padding: 4px 10px; border-color: rgba(46,196,182,0.4); color: #2ec4b6; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; cursor: pointer;" onclick="acceptAllSection('${secName}')">
                        <i data-lucide="check-check" style="width: 13px; height: 13px;"></i> Accept Section (${pendingInSec})
                       </button>`
                    : '';

                sectionsHtml += `
                    <div class="panel" style="padding: 18px 20px; border-radius: 12px; background: rgba(18, 18, 20, 0.85); border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(0,0,0,0.25);">
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
                                ${acceptSectionBtnHtml}
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
        const dateStr = (req.timestamp || req.date) ? InventoryTools.timestamp(req.timestamp || req.date) : '-';
        
        const parentIndent = req.indentId ? indentsData.find(i => i.id === req.indentId) : null;
        const indentNum = parentIndent ? (parentIndent.indentNumber || parentIndent.id) : null;

        let statusHtml = '';
        if (req.status === 'Pending') {
            statusHtml = `<span class="status pending" style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pending Supervisor</span>`;
        } else if (req.status === 'Accepted') {
            statusHtml = `<span class="status" style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">✓ Accepted (Ready to Consolidate)</span>`;
        } else if (req.status === 'Sent to Admin' || req.status === 'Consolidated') {
            statusHtml = `<span class="status" style="background: rgba(67,97,238,0.15); color: #4895ef; border: 1px solid rgba(67,97,238,0.3); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Sent to Admin</span>`;
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
                            <i data-lucide="file-text" style="width: 12px; height: 12px;"></i> Review Request
                        </button>
                    `;
                } else {
                    actionsHtml = `<span style="font-size: 0.75rem; color: #4895ef;">Awaiting Admin Approval</span>`;
                }
            } else if (req.status === 'Pending') {
                actionsHtml = `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Awaiting Supervisor</span>`;
            } else if (req.status === 'Accepted') {
                actionsHtml = `<span style="font-size: 0.75rem; color: #2ec4b6; font-style: italic;">Accepted by Supervisor</span>`;
            } else if (req.status === 'Approved') {
                actionsHtml = `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">✓ Approved</span>`;
            } else {
                actionsHtml = `<span style="font-size: 0.75rem; color: var(--danger); font-weight: 600;">✗ Rejected</span>`;
            }
        } else if (currentUser.role === 'supervisor') {
            if (req.status === 'Pending') {
                actionsHtml = `
                    <button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; background: rgba(46,196,182,0.18); border-color: rgba(46,196,182,0.4); color: #2ec4b6;" onclick="acceptChefRequest('${req.id}')" title="Accept this request from Chef">
                        <i data-lucide="check" style="width: 12px; height: 12px;"></i> Accept
                    </button>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.72rem; border-color: var(--danger); color: var(--danger);" onclick="deleteRequest('${req.id}')" title="Delete request">Delete</button>
                `;
            } else if (req.status === 'Accepted') {
                actionsHtml = `
                    <span style="font-size: 0.75rem; color: #2ec4b6; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                        <i data-lucide="boxes" style="width: 12px; height: 12px;"></i> Ready to Consolidate
                    </span>
                    <button class="btn btn-outline" style="padding: 2px 6px; font-size: 0.68rem; margin-left: 6px; color: var(--text-muted); border-radius: 4px;" onclick="revertChefRequest('${req.id}')" title="Revert to Pending">Undo</button>
                `;
            } else if (req.status === 'Sent to Admin' || req.status === 'Consolidated') {
                actionsHtml = `<span style="font-size: 0.75rem; color: #4895ef; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> Awaiting Admin Approval</span>`;
            } else if (req.status === 'Approved') {
                actionsHtml = `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">✓ Approved</span>`;
            }
        } else {
            if (req.status === 'Pending') {
                actionsHtml = `
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.7rem; border-color: var(--primary); color: var(--primary);" onclick="editRequest('${req.id}')">Edit</button>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.7rem; border-color: var(--danger); color: var(--danger);" onclick="deleteRequest('${req.id}')">Delete</button>
                `;
            } else if (req.status === 'Accepted') {
                actionsHtml = `<span style="font-size: 0.75rem; color: #2ec4b6; font-weight: 600;">Accepted by Supervisor</span>`;
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
        newStockSel.innerHTML = '<option value="" disabled selected>Select Ingredient</option>' + masterItemsData.filter(i => i.active !== false).map(i => `<option value="${i.id}">${i.name} (${i.unit})</option>`).join('');
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

async function submitConsolidatedIndent() {
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
    
    await saveData();
    
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
    return indent.createdAt ? InventoryTools.timestamp(indent.createdAt) : (indent.date || '-');
}

// Helper to extract a standard YYYY-MM-DD key from indent for date comparisons
function getIndentDateKey(indent) {
    if (indent.createdAt && !isNaN(Date.parse(indent.createdAt))) return InventoryTools.day(indent.createdAt);
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
    
    // Populate outlet filter options if needed
    const outletFilter = document.getElementById('filterIndentsOutlet');
    if (outletFilter) {
        const vis = getVisibleOutlets();
        const previous = outletFilter.value;
        outletFilter.disabled = vis.length === 1;
        outletFilter.innerHTML = (vis.length > 1 ? '<option value="all">All Outlets</option>' : '') + vis.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        outletFilter.value = vis.some(o => o.id === previous) ? previous : (vis.length === 1 ? vis[0].id : 'all');
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
        
        const totalQty = (indent.items || []).reduce((sum, item) => sum + (Number(item.revisedQty ?? item.originalQty) || 0), 0);
        
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
        dateDisplay = !isNaN(d) ? InventoryTools.timestamp(d) : rawDate;
    } catch(e) {
        dateDisplay = rawDate;
    }
    document.getElementById('apprModalDate').textContent = dateDisplay;
    
    let statusBadge = '';
    if (indent.status === 'Approved') {
        statusBadge = `<span class="status ok">Approved</span>`;
    } else if (indent.status === 'Rejected') {
        statusBadge = `<span class="status low">Rejected</span>`;
    } else if (indent.status && indent.status.startsWith('PO Raised')) {
        statusBadge = `<span class="status" style="background: rgba(67, 97, 238, 0.15); color: #4895ef; border: 1px solid rgba(67, 97, 238, 0.35); font-weight: 600; padding: 4px 10px; border-radius: 6px;"><i data-lucide="truck" style="width: 13px; height: 13px;"></i> ${indent.status}</span>`;
    } else {
        statusBadge = `<span class="status pending">${indent.status}</span>`;
    }
    if (indent.poNumber) {
        statusBadge += ` <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 8px;">(PO: <strong style="color: var(--primary); font-family: monospace;">${indent.poNumber}</strong>)</span>`;
    }
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

function openVendorPOModal() {
    return VendorOrderUI.open();
}

async function submitVendorPurchaseOrder() {
    return VendorOrderUI.submit();
}

function renderVendorPOTable() {
    const tbody = document.getElementById('vendorPOTableBody');
    if (!tbody) return;
    
    if (!purchaseOrdersData || purchaseOrdersData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No purchase orders yet. Use Raise to Vendor on a pending consolidated request to create separate vendor orders.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = purchaseOrdersData.map(po => {
        const itemsSummary = (po.items || []).map(it => `${it.itemName}: ${it.qty} ${it.unit || ''}`).join(', ');
        const countText = `${(po.items || []).length} items`;
        
        return `
            <tr>
                <td><strong style="color: var(--primary); font-family: monospace;">${po.poNumber}</strong></td>
                <td>${po.createdAt ? InventoryTools.timestamp(po.createdAt) : (po.date || '-')}</td>
                <td><strong style="color: #fff;">${po.vendorName}</strong></td>
                <td><span style="background: rgba(255,190,11,0.1); color: var(--primary); padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 0.78rem;">${po.outletName}</span></td>
                <td>
                    <div style="font-weight: 600;">${countText}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemsSummary}">${itemsSummary}</div>
                </td>
                <td><span class="status ok" style="background: rgba(67, 97, 238, 0.15); color: #4895ef; border: 1px solid rgba(67, 97, 238, 0.3); font-weight: 600; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="truck" style="width: 12px; height: 12px;"></i> ${po.status}</span></td>
                <td>${po.expectedDelivery || 'Not specified'} ${po.status !== 'Received' ? `<button class="btn btn-outline" data-receive-po="${po.id}">Receive</button>` : ''}</td>
                <td><button class="btn btn-primary" data-po-pdf="${VendorOrders.escape(po.id)}">Download PDF</button> <button class="btn btn-outline" data-po-print="${VendorOrders.escape(po.id)}">View / Print</button></td>
            </tr>
        `;
    }).join('');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.openConsolidationModal = () => window.switchToView('viewConsolidateRequests');
window.openIndentApprovalModal = openIndentApprovalModal;
window.openVendorPOModal = openVendorPOModal;
window.submitVendorPurchaseOrder = submitVendorPurchaseOrder;
window.renderVendorPOTable = renderVendorPOTable;

window.deleteSupervisorRequest = async function(indentId) {
    const idx = indentsData.findIndex(i => String(i.id) === String(indentId));
    if (idx === -1) return;
    const indent = indentsData[idx];
    const ref = indent.indentNumber || indent.id;
    const confirmed = await window.showConfirmModal(`Are you sure you want to delete supervisor request "${ref}"?`, "Delete Request", {
        type: 'danger',
        confirmText: 'Delete'
    });
    if (confirmed) {
        // Also reset any linked chef requests
        requestsData.forEach(r => {
            if (r.indentId === indentId) {
                delete r.indentId;
                r.status = 'Pending';
            }
        });
        indentsData.splice(idx, 1);
        await saveData();
        loadRequestsData();
        loadIndentsData();
        updateRequestsBadge();
        updateIndentsBadge();
        window.showToast(`Deleted request ${ref}`, 'info');
    }
};

// Global live sync receiver across browser tabs/windows and local data changes
function onLiveSyncReceived() {
    if (typeof reloadDataFromStorage === 'function') {
        reloadDataFromStorage();
    }
    if (currentUser) {
        const updated = usersData.find(u => u.username.toLowerCase() === currentUser.username.toLowerCase());
        if (updated) currentUser = updated;
    }
    if (typeof updateRequestsBadge === 'function') updateRequestsBadge();
    if (typeof updateIndentsBadge === 'function') updateIndentsBadge();
    if (typeof updateFormSelects === 'function' && typeof getVisibleOutlets === 'function') {
        updateFormSelects(getVisibleOutlets());
    }
    
    // Live update active view without disrupting user typing
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
    
    if (currentView === 'viewRequests' && typeof loadRequestsData === 'function') {
        loadRequestsData();
    } else if (currentView === 'viewMasterOrders' && typeof loadDashboardData === 'function') {
        loadDashboardData();
    } else if (currentView === 'viewIndents' && typeof loadIndentsData === 'function') {
        loadIndentsData();
    } else if (currentView === 'viewConsolidateRequests' && typeof loadConsolidateWorkspace === 'function') {
        const isEditingInMatrix = isTyping && activeEl.closest('#wsConsolidatePrintArea');
        if (!isEditingInMatrix) {
            loadConsolidateWorkspace();
        }
    } else if (currentView === 'viewChefPortal' && typeof loadChefPortalData === 'function') {
        loadChefPortalData();
    } else if (currentView === 'viewVendors' && typeof loadVendorsData === 'function') {
        loadVendorsData();
    } else if (currentView === 'viewLocations' && typeof loadLocationsData === 'function') {
        loadLocationsData();
    } else if (currentView === 'viewUsers' && typeof loadUsersData === 'function') {
        if (typeof switchUserSubdivision === 'function') {
            switchUserSubdivision(currentUserSubdivision || 'supervisor');
        } else {
            loadUsersData();
        }
    } else if (currentView === 'viewAddChef' && typeof loadAddChefView === 'function') {
        loadAddChefView();
    }
}
window.onLiveSyncReceived = onLiveSyncReceived;

if (typeof BroadcastChannel !== 'undefined') {
    const appLiveChannel = new BroadcastChannel('nchef_live_channel');
    appLiveChannel.onmessage = () => {
        onLiveSyncReceived();
    };
}
window.addEventListener('storage', () => {
    onLiveSyncReceived();
});

window.approveRequest = async function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req) return;
    
    const item = masterItemsData.find(i => i.id === req.itemId);
    if (!item) {
        window.showUiModal({
            title: "Item Missing",
            message: "Item no longer exists in inventory.",
            type: "warning"
        });
        return;
    }
    
    // Check stock
    const currentTotal = getItemTotalQty(item);
    const available = committedState.outletStock.find(s => s.item_id === item.id && s.outlet_id === req.outletId)?.quantity || 0;
    
    const approveQtyStr = await window.showPromptModal(`Requested: ${req.qty}. Available in stock: ${available}.\nEnter amount to allocate:`, Math.min(req.qty, available), "Allocate Stock");
    
    if (approveQtyStr === null || approveQtyStr === false) return;
    
    const approveQty = parseFloat(approveQtyStr);
    
    if (isNaN(approveQty) || approveQty <= 0) {
        window.showUiModal({
            title: "Invalid Quantity",
            message: "Please enter a valid positive number.",
            type: "warning"
        });
        return;
    }
    
    if (approveQty > available) {
        window.showUiModal({
            title: "Insufficient Stock",
            message: `Not enough stock available. You currently have ${available} ${item.unit || ''} in store.`,
            type: "warning"
        });
        return;
    }
    
    await runDatabaseAction('requests/approve', { requestId: req.id, quantity: approveQty });
    loadRequestsData();
    loadDashboardData();
    window.showUiModal({
        title: "Stock Allocated",
        message: `Successfully allocated ${approveQty} ${item.unit || ''} of ${item.name} to outlet.`,
        type: "success"
    });
};

window.rejectRequest = async function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (req) {
        req.status = 'Rejected';
        await saveData();
        loadRequestsData();
        if (typeof loadChefPortalData === 'function') loadChefPortalData();
        updateRequestsBadge();
    }
};

window.acceptChefRequest = async function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req) return;
    req.status = 'Accepted';
    req.acceptedBy = (currentUser && currentUser.name) ? currentUser.name : 'Supervisor';
    req.acceptedAt = new Date().toISOString();
    
    await saveData();
    loadRequestsData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    
    window.showToast(`Accepted "${req.itemName}" (${req.qty} ${req.unit || 'kg'}). Ready to consolidate.`, "success");
};

window.revertChefRequest = async function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req) return;
    req.status = 'Pending';
    delete req.acceptedBy;
    delete req.acceptedAt;
    
    await saveData();
    loadRequestsData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    
    window.showToast(`Reverted "${req.itemName}" to pending status.`, "info");
};

window.acceptAllSection = async function(secName) {
    const vis = getVisibleOutlets();
    const visIds = vis.map(o => (o.id || '').toLowerCase());
    const pendingInSec = requestsData.filter(r => {
        if (r.status !== 'Pending') return false;
        if ((r.cuisine || '').toLowerCase() !== (secName || '').toLowerCase()) return false;
        const rOutletId = (r.outletId || '').toLowerCase();
        return rOutletId === outlet.id.toLowerCase();
    });
    
    if (pendingInSec.length === 0) {
        window.showToast(`No pending requests in ${secName} section.`, "info");
        return;
    }
    
    const nowIso = new Date().toISOString();
    const supName = (currentUser && currentUser.name) ? currentUser.name : 'Supervisor';
    pendingInSec.forEach(r => {
        r.status = 'Accepted';
        r.acceptedBy = supName;
        r.acceptedAt = nowIso;
    });
    
    await saveData();
    loadRequestsData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    
    window.showToast(`Accepted all ${pendingInSec.length} requests in ${secName} section! Ready to consolidate.`, "success");
};

window.sendRequestToAdmin = async function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req) return;
    
    const chefDisplay = req.chefName || req.requestedBy || 'Chef';
    const promptMsg = `Send "${req.itemName}" (${req.qty} ${req.unit || 'kg'}) from ${chefDisplay} to Admin for approval?\nConfirm or modify the requested quantity:`;
    const newQtyStr = await window.showPromptModal(promptMsg, req.qty, "Forward to Admin");
    if (newQtyStr === null || newQtyStr === false) return;
    
    const newQty = parseFloat(newQtyStr);
    if (!isNaN(newQty) && newQty > 0) {
        req.qty = newQty;
    }
    
    req.status = 'Sent to Admin';
    req.forwardedBy = (currentUser && currentUser.name) ? currentUser.name : 'Supervisor';
    req.forwardedAt = new Date().toISOString();
    
    await saveData();
    loadRequestsData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    
    window.showUiModal({
        title: "Forwarded to Admin",
        message: `Request for ${req.itemName} (${req.qty} ${req.unit || 'kg'}) forwarded to Admin for approval!`,
        type: "success"
    });
};

window.updateSectionItemQty = async function(reqId, val) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req) return;
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
        req.qty = num;
        await saveData();
    }
};

// ============================================================
// CONSOLIDATE REQUESTS WORKSPACE (Dedicated Supervisor View)
// ============================================================
let activeWorkspaceConsolidation = {
    outletId: '',
    outletName: '',
    groupedItems: {}
};

window.loadConsolidateWorkspace = function() {
    const vis = getVisibleOutlets();
    const visIds = vis.map(o => (o.id || '').toLowerCase());
    const outlet = vis.find(o => o.id === OutletSelection.restore()) || vis[0];
    if (!outlet) return;
    
    activeWorkspaceConsolidation = {
        outletId: outlet.id,
        outletName: outlet.name,
        groupedItems: {}
    };
    
    const outletNameEl = document.getElementById('wsConsolidateOutletName');
    if (outletNameEl) outletNameEl.textContent = outlet.name;
    
    // Wire up top, mid & bottom events once
    ['btnWsSubmitIndent', 'btnWsSubmitIndentTop', 'btnWsSubmitIndentMid'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn && !btn.dataset.bound) {
            btn.addEventListener('click', window.submitWorkspaceConsolidatedIndent);
            btn.dataset.bound = 'true';
        }
    });

    ['btnWsExportPdf', 'btnWsExportPdfTop'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn && !btn.dataset.bound) {
            btn.addEventListener('click', window.exportConsolidationToPdf);
            btn.dataset.bound = 'true';
        }
    });
    
    // Collect all requests for this supervisor outlet that are 'Accepted' or 'Pending'
    const targetReqs = requestsData.filter(r => {
        if (r.status !== 'Accepted' && r.status !== 'Pending') return false;
        const rOutletId = (r.outletId || '').toLowerCase();
        return rOutletId === outlet.id.toLowerCase();
    });
    
    targetReqs.forEach(req => {
        const item = masterItemsData.find(i => i.id === req.itemId) || { id: req.itemId, name: req.itemName || 'Unknown Item', unit: req.unit || 'kg', category: 'General' };
        if (!activeWorkspaceConsolidation.groupedItems[req.itemId]) {
            activeWorkspaceConsolidation.groupedItems[req.itemId] = {
                itemId: req.itemId,
                itemName: item.name,
                category: item.category || 'General',
                unit: item.unit || req.unit || 'kg',
                originalQty: 0,
                revisedQty: 0,
                comment: '',
                chefRequests: []
            };
        }
        const q = parseFloat(req.qty) || 0;
        activeWorkspaceConsolidation.groupedItems[req.itemId].originalQty += q;
        activeWorkspaceConsolidation.groupedItems[req.itemId].revisedQty += req.revisedQty ?? q;
        activeWorkspaceConsolidation.groupedItems[req.itemId].chefRequests.push({...req, revisedQty: req.revisedQty ?? q});
    });
    
    window.renderConsolidateWorkspaceTable();
};

window.renderConsolidateWorkspaceTable = function() {
    const thead = document.getElementById('wsConsolidateTableHead');
    const tbody = document.getElementById('wsConsolidateTableBody');
    const countEl = document.getElementById('wsConsolidateCount');
    const summaryTextEl = document.getElementById('wsFooterSummaryText');
    if (!tbody || !thead) return;
    
    const items = Object.values(activeWorkspaceConsolidation.groupedItems || {});
    if (countEl) {
        countEl.textContent = `${items.length} ingredient${items.length === 1 ? '' : 's'} ready for consolidation`;
    }
    
    if (items.length === 0) {
        thead.innerHTML = `<tr><th style="padding: 12px 16px;">Ingredient</th><th style="padding: 12px 16px;">Total</th></tr>`;
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 36px 20px;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <i data-lucide="check-circle" style="width: 32px; height: 32px; color: var(--primary);"></i>
                <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-main);">No Requests Pending Consolidation</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Chef and supervisor requests raised under Requests → Raise Request appear here.</div>
            </div>
        </td></tr>`;
        if (summaryTextEl) summaryTextEl.textContent = 'No ingredients currently pending consolidation.';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Discover all unique kitchen sections from requests
    const allCuisines = new Set();
    items.forEach(it => {
        (it.chefRequests || []).forEach(cr => {
            if (cr.cuisine && cr.cuisine.trim() && cr.cuisine.trim().toLowerCase() !== 'general') {
                allCuisines.add(cr.cuisine.trim());
            }
        });
    });

    const standardOrder = ['Indian', 'Tandoor', 'Continental', 'Chinese', 'Bakery', 'Pantry'];
    const sections = Array.from(allCuisines).sort((a, b) => {
        const ia = standardOrder.indexOf(a);
        const ib = standardOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });
    if (sections.length === 0) sections.push('Indian', 'Tandoor');

    // 1. Render Table Head (Matching user's matrix: Ingredient | Indian | Tandoor | ... | Total | Supervisor Note)
    thead.innerHTML = `
        <tr style="border-bottom: 2px solid rgba(255,190,11,0.25);">
            <th style="text-align: left; padding: 12px 16px; background: rgba(0,0,0,0.5); color: #fff; font-weight: 700; width: 24%;">Ingredient</th>
            ${sections.map(sec => `
                <th style="text-align: center; padding: 12px 14px; background: rgba(255,190,11,0.08); color: var(--primary); font-weight: 700; border-left: 1px solid rgba(255,255,255,0.06); font-size: 0.88rem;">
                    ${sec}
                </th>
            `).join('')}
            <th style="text-align: center; padding: 12px 16px; background: rgba(255,190,11,0.18); color: #fff; font-weight: 800; border-left: 1px solid rgba(255,190,11,0.3); width: 16%;">Total</th>
            <th style="text-align: left; padding: 12px 14px; background: rgba(0,0,0,0.4); color: var(--text-muted); font-weight: 600; width: 22%; border-left: 1px solid rgba(255,255,255,0.06);">Supervisor Note</th>
        </tr>
    `;

    // 2. Render Table Body (Matrix Rows)
    let grandSum = 0;

    tbody.innerHTML = items.map(entry => {
        grandSum += (parseFloat(entry.revisedQty) || 0);

        const secCellsHtml = sections.map(sec => {
            const secReqs = (entry.chefRequests || []).filter(cr => (cr.cuisine || '').toLowerCase() === sec.toLowerCase());
            const secQty = secReqs.reduce((sum,cr) => sum + (cr.revisedQty ?? cr.qty), 0);
            if (!secReqs.length) return '<td style="text-align:center">—</td>';
            return `<td style="text-align:center;padding:10px 14px"><input aria-label="${entry.itemName} - ${sec}" type="number" min="0" step="any" value="${secQty}" data-cuisine-qty="${entry.itemId}" oninput="updateWorkspaceCuisineQty('${entry.itemId}','${encodeURIComponent(sec)}',this)" style="width:82px;padding:6px;background:var(--dark);color:var(--text-main);border:1px solid var(--border);border-radius:6px"><span style="font-size:.75rem"> ${entry.unit}</span></td>`;
        }).join('');
        const totalCell = `<td style="text-align:center;padding:10px 14px;background:rgba(255,190,11,.08)"><output id="wsItemTotal_${entry.itemId}">${entry.revisedQty}</output> ${entry.unit}</td>`;

        // Note / comments
        const noteCell = `<td style="padding: 10px 14px; border-left: 1px solid rgba(255,255,255,0.04);">
            <div style="display: flex; align-items: center; gap: 6px;">
                <input type="text" placeholder="Reason / note..." value="${entry.comment || ''}" oninput="updateWorkspaceItemComment('${entry.itemId}', this.value)" style="width: 100%; padding: 5px 8px; font-size: 0.82rem; background: #0d0d0d; color: #fff; border: 1px solid var(--border); border-radius: 5px;">
            </div>
        </td>`;

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td style="padding: 12px 16px;">
                    <strong style="color: var(--text-main); font-size: 0.95rem;">${entry.itemName}</strong>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">${entry.category}</div>
                </td>
                ${secCellsHtml}
                ${totalCell}
                ${noteCell}
            </tr>
        `;
    }).join('');

    // Summary footer row
    const sectionTotalsHtml = sections.map(sec => {
        let secSum = 0;
        items.forEach(it => {
            const reqs = (it.chefRequests || []).filter(cr => (cr.cuisine || '').toLowerCase() === sec.toLowerCase());
            secSum += reqs.reduce((acc, cr) => acc + (cr.revisedQty ?? (parseFloat(cr.qty) || 0)), 0);
        });
        return `<td data-section-total="${encodeURIComponent(sec)}" style="text-align: center; padding: 12px; font-weight: 800; color: var(--primary); border-left: 1px solid rgba(255,255,255,0.06); font-size: 0.92rem;">${secSum.toFixed(1)}</td>`;
    }).join('');

    tbody.innerHTML += `
        <tr style="background: rgba(0,0,0,0.55); border-top: 2px solid rgba(255,190,11,0.3);">
            <td style="padding: 14px 16px; font-weight: 800; color: var(--primary); text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px;">
                Total Section Units
            </td>
            ${sectionTotalsHtml}
            <td id="wsMatrixGrandTotalCell" style="text-align: center; padding: 12px; font-weight: 800; color: #fff; background: rgba(255,190,11,0.15); border-left: 1px solid rgba(255,190,11,0.3); font-size: 1rem;">
                ${grandSum.toFixed(1)}
            </td>
            <td style="border-left: 1px solid rgba(255,255,255,0.06);"></td>
        </tr>
    `;

    if (summaryTextEl) {
        summaryTextEl.textContent = `Consolidating ${items.length} items (${grandSum.toFixed(1)} units total across ${sections.length} sections)`;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.exportConsolidationToPdf = function() {
    const invalid = document.querySelector('#wsConsolidateTableBody input:invalid');
    if (invalid) { invalid.reportValidity(); return; }
    const items = Object.values(activeWorkspaceConsolidation.groupedItems || {});
    items.forEach(entry => { entry.revisedQty = entry.chefRequests.reduce((sum,r)=>sum+(r.revisedQty ?? r.qty),0); });
    if (items.length === 0) {
        window.showToast("No ingredients to export.", "warning");
        return;
    }

    const outletName = activeWorkspaceConsolidation.outletName || 'BRIGADE';
    const dateStr = InventoryTools.day();
    const timeStr = InventoryTools.timestamp(new Date());
    const supervisor = (currentUser && currentUser.name) ? currentUser.name : 'Supervisor';
    const indentRef = 'IND-PREVIEW-' + new Date().toISOString().slice(0,10).replace(/-/g,'');

    // Discover sections
    const allCuisines = new Set();
    items.forEach(it => {
        (it.chefRequests || []).forEach(cr => {
            if (cr.cuisine && cr.cuisine.trim() && cr.cuisine.trim().toLowerCase() !== 'general') {
                allCuisines.add(cr.cuisine.trim());
            }
        });
    });
    const standardOrder = ['Indian', 'Tandoor', 'Continental', 'Chinese', 'Bakery', 'Pantry'];
    const sections = Array.from(allCuisines).sort((a, b) => {
        const ia = standardOrder.indexOf(a);
        const ib = standardOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });
    if (sections.length === 0) sections.push('Indian', 'Tandoor');

    // Build print HTML document
    const printDoc = document.createElement('div');
    printDoc.id = 'pdfExportRenderContainer';
    printDoc.style.background = '#ffffff';
    printDoc.style.color = '#111111';
    printDoc.style.fontFamily = 'Inter, Arial, sans-serif';
    printDoc.style.padding = '24px 30px';
    printDoc.style.width = '100%';
    printDoc.style.boxSizing = 'border-box';

    let totalPrintQty = 0;
    const rowsHtml = items.map((entry, idx) => {
        totalPrintQty += (parseFloat(entry.revisedQty) || 0);
        const secCells = sections.map(sec => {
            const secReqs = (entry.chefRequests || []).filter(cr => (cr.cuisine || '').toLowerCase() === sec.toLowerCase());
            const secQty = secReqs.reduce((acc, cr) => acc + (cr.revisedQty ?? (parseFloat(cr.qty) || 0)), 0);
            return `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-weight: ${secQty > 0 ? '700' : 'normal'};">
                ${secQty > 0 ? `${secQty} ${entry.unit}` : '-'}
            </td>`;
        }).join('');

        return `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                <td style="border: 1px solid #ddd; padding: 8px 10px; font-weight: 600;">
                    ${entry.itemName}
                    <div style="font-size: 11px; color: #666;">${entry.category}</div>
                </td>
                ${secCells}
                <td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-weight: 700; background: #fff8e7;">
                    ${entry.revisedQty} ${entry.unit}
                </td>
                <td style="border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; color: #555;">
                    ${entry.comment || '-'}
                </td>
            </tr>
        `;
    }).join('');

    printDoc.innerHTML = `
        <div style="border-bottom: 3px solid #ffbe0b; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h1 style="margin: 0; font-size: 24px; color: #111; font-weight: 800; letter-spacing: -0.5px;">n.chef <span style="color: #d49500; font-weight: 700;">Stock Tracker</span></h1>
                <div style="font-size: 14px; font-weight: 700; color: #333; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Consolidated Kitchen Indent Request</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #555;">
                <div><strong>Ref:</strong> ${indentRef}</div>
                <div><strong>Date:</strong> ${dateStr} ${timeStr}</div>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; background: #f4f4f4; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 18px; margin-bottom: 20px; font-size: 13px;">
            <div><strong>Outlet:</strong> <span style="color: #d49500; font-weight: 700;">${outletName}</span></div>
            <div><strong>Prepared By (Supervisor):</strong> ${supervisor}</div>
            <div><strong>Total Line Items:</strong> ${items.length} ingredients (${totalPrintQty.toFixed(1)} units)</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 26px;">
            <thead>
                <tr style="background: #222; color: #fff;">
                    <th style="border: 1px solid #222; padding: 9px 10px; text-align: left;">Ingredient</th>
                    ${sections.map(s => `<th style="border: 1px solid #222; padding: 9px 10px; text-align: center;">${s}</th>`).join('')}
                    <th style="border: 1px solid #222; padding: 9px 10px; text-align: center; background: #d49500; color: #000;">Total</th>
                    <th style="border: 1px solid #222; padding: 9px 10px; text-align: left;">Notes</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; padding: 0 20px; font-size: 13px;">
            <div style="border-top: 1px solid #888; width: 220px; text-align: center; padding-top: 6px;">
                <strong>Supervisor Signature</strong>
                <div style="font-size: 11px; color: #777;">${supervisor}</div>
            </div>
            <div style="border-top: 1px solid #888; width: 220px; text-align: center; padding-top: 6px;">
                <strong>Admin Approval Signature</strong>
                <div style="font-size: 11px; color: #777;">Authorized Signatory</div>
            </div>
        </div>
    `;

    // Check if html2pdf is available
    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin:       8,
            filename:     `Consolidated_Indent_${outletName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        
        window.showToast("Generating PDF download...", "info");
        html2pdf().set(opt).from(printDoc).save().then(() => {
            window.showToast("PDF downloaded successfully!", "success");
        }).catch(err => {
            console.error(err);
            openPrintFallback(printDoc);
        });
    } else {
        openPrintFallback(printDoc);
    }

    function openPrintFallback(element) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            window.showToast("Please allow popups to export PDF.", "warning");
            return;
        }
        printWindow.document.write(`
            <html>
                <head>
                    <title>Consolidated Indent - ${outletName}</title>
                    <style>
                        @page { size: landscape; margin: 10mm; }
                        body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 10px; color: #111; }
                    </style>
                </head>
                <body>
                    ${element.innerHTML}
                    <script>
                        window.onload = function() {
                            window.print();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }
};

window.updateWorkspaceCuisineQty = function(itemId, encodedCuisine, input) {
    const quantity = Number(input.value);
    if (!input.value.trim() || !Number.isFinite(quantity) || quantity < 0) {
        input.setCustomValidity('Enter a non-negative quantity.'); return;
    }
    input.setCustomValidity('');
    const entry = activeWorkspaceConsolidation.groupedItems[itemId];
    if (!entry) return;
    const cuisine = decodeURIComponent(encodedCuisine);
    InventoryTools.reviseCuisine(entry, cuisine, quantity);
    const total = document.getElementById('wsItemTotal_'+itemId);
    if (total) total.textContent = Number(entry.revisedQty.toFixed(6));
    const items = Object.values(activeWorkspaceConsolidation.groupedItems);
    const grandSum = items.reduce((sum,it)=>sum+it.revisedQty,0);
    document.getElementById('wsMatrixGrandTotalCell').textContent = grandSum.toFixed(1);
    document.querySelectorAll('[data-section-total]').forEach(cell=>{
        const section=decodeURIComponent(cell.dataset.sectionTotal);
        cell.textContent=items.reduce((sum,it)=>sum+(it.chefRequests || []).filter(r=>r.cuisine===section).reduce((s,r)=>s+(r.revisedQty ?? r.qty),0),0).toFixed(1);
    });
    const summary=document.getElementById('wsFooterSummaryText');
    if (summary) summary.textContent=`Consolidating ${items.length} items (${grandSum.toFixed(1)} units total)`;
};

window.updateWorkspaceItemComment = function(itemId, val) {
    if (activeWorkspaceConsolidation.groupedItems[itemId]) {
        activeWorkspaceConsolidation.groupedItems[itemId].comment = val;
    }
};

window.submitWorkspaceConsolidatedIndent = async function() {
    const invalid = document.querySelector('#wsConsolidateTableBody input:invalid');
    if (invalid) { invalid.reportValidity(); return; }
    Object.values(activeWorkspaceConsolidation.groupedItems || {}).forEach(entry => {
        entry.revisedQty = entry.chefRequests.reduce((sum,r)=>sum+(r.revisedQty ?? r.qty),0);
    });
    const items = Object.values(activeWorkspaceConsolidation.groupedItems || {});
    if (items.length === 0) {
        window.showUiModal({
            title: "No Items to Consolidate",
            message: "There are no accepted or pending chef requests to consolidate.",
            type: "warning"
        });
        return;
    }
    
    // Count how many items have adjustments or notes
    const adjustedItems = items.filter(it => Math.abs((parseFloat(it.revisedQty) || 0) - (parseFloat(it.originalQty) || 0)) > 0.001 || (it.comment && it.comment.trim()));
    const grandUnits = items.reduce((sum, it) => sum + (parseFloat(it.revisedQty) || 0), 0);
    
    let confirmPrompt = `Send consolidated request with ${items.length} ingredients (${grandUnits.toFixed(1)} total units) to Admin for approval?`;
    if (adjustedItems.length > 0) {
        confirmPrompt += `\n\nNote: ${adjustedItems.length} item(s) have supervisor quantity modifications or notes that will be included in the request.`;
    }
    
    const confirmed = await window.showConfirmModal(
        confirmPrompt,
        "Send Request To Admin",
        { confirmText: "Send Request To Admin" }
    );
    if (!confirmed) return;
    
    const today = InventoryTools.day();
    const indentNumber = 'REQ-' + InventoryTools.day().replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);
    const indentId = 'ind_' + Date.now();
    
    const formattedItems = items.map(entry => {
        const breakdown = (entry.chefRequests || []).map(cr => ({
            cuisine: cr.cuisine || 'Cuisine Section',
            chef: cr.chefName || cr.requestedBy || 'Chef',
            qty: cr.revisedQty ?? (parseFloat(cr.qty) || 0)
        }));
        return {
            itemId: entry.itemId,
            itemName: entry.itemName,
            category: entry.category,
            unit: entry.unit,
            originalQty: entry.originalQty,
            revisedQty: parseFloat(entry.revisedQty) || 0,
            comment: entry.comment || '',
            cuisineBreakdown: breakdown
        };
    });
    
    const newIndent = {
        id: indentId,
        indentNumber: indentNumber,
        date: today,
        outletId: activeWorkspaceConsolidation.outletId,
        outletName: activeWorkspaceConsolidation.outletName,
        supervisorName: currentUser.name || 'Supervisor',
        status: 'Pending Approval',
        items: formattedItems,
        createdAt: new Date().toISOString()
    };
    
    indentsData.unshift(newIndent);
    
    // Update underlying chef requests with revised quantities & supervisor notes
    const nowIso = new Date().toISOString();
    const supName = currentUser.name || 'Supervisor';
    
    items.forEach(entry => {
        if (entry.chefRequests && entry.chefRequests.length > 0) {
            entry.chefRequests.forEach(cr => {
                const targetReq = requestsData.find(r => r.id === cr.id);
                if (targetReq) {
                    targetReq.status = 'Consolidated';
                    targetReq.indentId = indentId;
                    targetReq.forwardedBy = supName;
                    targetReq.forwardedAt = nowIso;
                    targetReq.revisedQty = cr.revisedQty ?? cr.qty;
                    if (entry.comment) {
                        targetReq.supervisorNote = entry.comment;
                    }

                }
            });
        } else if (entry.originalQty === 0) {
            // Extra stock item added by supervisor directly in this workspace
            requestsData.push({
                id: 'req_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                itemId: entry.itemId,
                itemName: entry.itemName,
                qty: parseFloat(entry.revisedQty) || 0,
                revisedQty: parseFloat(entry.revisedQty) || 0,
                unit: entry.unit,
                outletId: activeWorkspaceConsolidation.outletId,
                outletName: activeWorkspaceConsolidation.outletName,
                requestedBy: supName,
                chefName: supName,
                cuisine: 'Supervisor Extra',
                status: 'Consolidated',
                indentId: indentId,
                date: today,
                timestamp: nowIso,
                supervisorNote: entry.comment || 'Supervisor Addition'
            });
        }
    });
    
    await saveData();
    loadRequestsData();
    loadIndentsData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    updateIndentsBadge();
    
    window.showUiModal({
        title: "Request Sent to Admin",
        message: `Consolidated Request ${indentNumber} (${items.length} items, ${grandUnits.toFixed(1)} units) has been sent to Admin for approval with your updated quantities and notes!`,
        type: "success"
    });
    
    // Refresh consolidate workspace table to reflect submitted state
    window.loadConsolidateWorkspace();
};

window.sendAllSectionsToAdmin = function() {
    const navConsolidate = document.getElementById('navConsolidateRequests');
    if (navConsolidate) {
        navConsolidate.click();
    } else {
        window.loadConsolidateWorkspace();
    }
};

window.adminApproveAllSections = async function() {
    const filterOutlet = document.getElementById('filterOutlet')?.value || 'all';
    const targetReqs = requestsData.filter(r => {
        if (!['Sent to Admin', 'Pending', 'Accepted', 'Consolidated'].includes(r.status)) return false;
        if (filterOutlet !== 'all' && r.outletId !== filterOutlet) return false;
        return true;
    });
    
    if (targetReqs.length === 0 && !indentsData.some(i => i.status === 'Pending Approval' && (filterOutlet === 'all' || i.outletId === filterOutlet))) {
        window.showUiModal({
            title: "No Requests",
            message: "No pending section requests to approve.",
            type: "warning"
        });
        return;
    }
    
    const confirmed = await window.showConfirmModal(`Approve all ${targetReqs.length} section requests and allocate stock to the respective outlets?`, "Approve All Requests", {
        confirmText: 'Approve All'
    });
    if (!confirmed) return;
    
    await runDatabaseAction('indents/approve-all', { outletId: filterOutlet });
    loadRequestsData();
    loadIndentsData();
    loadDashboardData();
    if (typeof loadChefPortalData === 'function') loadChefPortalData();
    updateRequestsBadge();
    updateIndentsBadge();
    
    window.showUiModal({
        title: "Requests Approved",
        message: `Successfully approved all ${targetReqs.length} section requests! Stock allocated to outlets.`,
        type: "success"
    });
};

window.editRequest = async function(reqId) {
    const req = requestsData.find(r => r.id === reqId);
    if (!req || req.status !== 'Pending') return;
    
    const newQtyStr = await window.showPromptModal("Enter new quantity for this request:", req.qty, "Edit Quantity");
    if (newQtyStr === null || newQtyStr === false) return;
    
    const newQty = parseFloat(newQtyStr);
    if (isNaN(newQty) || newQty <= 0) {
        window.showUiModal({
            title: "Invalid Quantity",
            message: "Please enter a valid numeric quantity.",
            type: "warning"
        });
        return;
    }
    
    req.qty = newQty;
    await saveData();
    loadRequestsData();
};

window.deleteRequest = async function(reqId) {
    const req = requestsData.find(r => String(r.id) === String(reqId));
    if (!req || req.status !== 'Pending') return;
    
    const confirmed = await window.showConfirmModal(`Are you sure you want to delete the request for "${req.itemName}"?`, "Delete Request", {
        type: 'danger',
        confirmText: 'Delete'
    });
    if (confirmed) {
        const reqIndex = requestsData.findIndex(r => String(r.id) === String(reqId));
        if (reqIndex !== -1) {
            const itemName = requestsData[reqIndex].itemName;
            requestsData.splice(reqIndex, 1);
            await saveData();
            loadRequestsData();
            updateRequestsBadge();
            if (typeof loadChefPortalData === 'function') loadChefPortalData();
            window.showToast(`Deleted request for ${itemName}`, 'info');
        }
    }
};

function loadVendorsData() {
    const tbody = document.getElementById('vendorsTableBody');
    const badge = document.getElementById('vendorsCountBadge');
    if (badge) badge.textContent = `${vendorsData.length} Vendor${vendorsData.length === 1 ? '' : 's'}`;

    if (tbody) {
        if (vendorsData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted); padding: 24px;">No vendors registered yet. Use the form below to add a vendor.</td></tr>`;
        } else {
            tbody.innerHTML = vendorsData.map(v => `
                <tr>
                    <td><strong style="color: var(--text-main); font-size: 0.92rem;">${v.name}</strong></td>
                    <td style="text-align: left; padding-left: 12px; white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <button type="button" class="btn btn-outline" onclick="editVendor('${v.id}')" title="Edit Vendor" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(255,190,11,0.5); color: var(--primary); background: rgba(255,190,11,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                                <i data-lucide="edit" style="width: 13px; height: 13px;"></i> Edit
                            </button>
                            <button type="button" class="btn btn-outline" onclick="removeVendor('${v.id}')" title="Remove Vendor" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(239,71,111,0.5); color: #ef476f; background: rgba(239,71,111,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    }
    if (typeof renderVendorPOTable === 'function') {
        renderVendorPOTable();
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.editVendor = function(id) {
    const v = vendorsData.find(vend => vend.id === id);
    if (!v) return;
    document.getElementById('editVendorId').value = v.id;
    document.getElementById('newVendorName').value = v.name;
    document.getElementById('vendorFormTitle').textContent = `Edit Vendor: ${v.name}`;
    document.getElementById('cancelEditVendorBtn')?.classList.remove('hidden');
    document.getElementById('newVendorName')?.focus();
};

window.resetVendorForm = function() {
    document.getElementById('editVendorId').value = '';
    document.getElementById('newVendorName').value = '';
    document.getElementById('vendorFormTitle').textContent = 'Add Vendor';
    document.getElementById('cancelEditVendorBtn')?.classList.add('hidden');
};

window.removeVendor = async function(id) {
    const v = vendorsData.find(vend => vend.id === id);
    if (!v) return;

    const confirmed = await window.showConfirmModal(`Are you sure you want to remove vendor "${v.name}"?`, "Remove Vendor", {
        danger: true,
        confirmText: "Remove"
    });
    if (!confirmed) return;

    const idx = vendorsData.findIndex(vend => vend.id === id);
    if (idx > -1) {
        vendorsData.splice(idx, 1);
        await saveData();
        loadVendorsData();
        updateFormSelects(getVisibleOutlets());
        window.showToast(`Vendor ${v.name} removed.`, "info");
    }
};

// ============================================================
// USER MANAGEMENT & SUBDIVISIONS (Supervisors, Chefs, Admins)
// ============================================================
let currentUserSubdivision = 'supervisor';
let userEventsInitialized = false;

function initUserManagementEvents() {
    if (userEventsInitialized) return;
    userEventsInitialized = true;

    // Sub-tab switching
    document.querySelectorAll('.user-sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const sub = tab.dataset.sub;
            if (sub) switchUserSubdivision(sub);
        });
    });

    // 1. Supervisor Form Listeners
    const btnSaveSup = document.getElementById('btnSaveSupervisorSubmit');
    if (btnSaveSup) btnSaveSup.addEventListener('click', saveSupervisorUser);
    const btnCancelSup = document.getElementById('btnCancelEditSupervisor');
    if (btnCancelSup) btnCancelSup.addEventListener('click', resetSupervisorForm);

    // 2. Admin Chef Form Listeners
    const btnSaveAdminChef = document.getElementById('btnSaveAdminChefSubmit');
    if (btnSaveAdminChef) btnSaveAdminChef.addEventListener('click', saveAdminChefUser);
    const btnCancelAdminChef = document.getElementById('btnCancelEditAdminChef');
    if (btnCancelAdminChef) btnCancelAdminChef.addEventListener('click', resetAdminChefForm);

    // 3. Admin User Form Listeners
    const btnSaveAdminUser = document.getElementById('btnSaveAdminUserSubmit');
    if (btnSaveAdminUser) btnSaveAdminUser.addEventListener('click', saveAdminUser);
    const btnCancelAdminUser = document.getElementById('btnCancelEditAdminUser');
    if (btnCancelAdminUser) btnCancelAdminUser.addEventListener('click', resetAdminUserForm);
}

function switchUserSubdivision(subKey) {
    currentUserSubdivision = subKey;
    localStorage.setItem('nchef_active_subdivision', subKey);
    initUserManagementEvents();

    // Update Tab Buttons
    document.querySelectorAll('.user-sub-tab').forEach(tab => {
        if (tab.dataset.sub === subKey) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update Sidebar Sub-items if open
    const navSubSupervisors = document.getElementById('navSubSupervisors');
    const navSubChefs = document.getElementById('navSubChefs');
    const navSubAdmins = document.getElementById('navSubAdmins');
    if (navSubSupervisors) navSubSupervisors.classList.toggle('active', subKey === 'supervisor');
    if (navSubChefs) navSubChefs.classList.toggle('active', subKey === 'chef');
    if (navSubAdmins) navSubAdmins.classList.toggle('active', subKey === 'admin');

    // Toggle Content Sections
    const secSup = document.getElementById('userSectionSupervisor');
    const secChef = document.getElementById('userSectionChef');
    const secAdmin = document.getElementById('userSectionAdmin');
    const secAll = document.getElementById('userSectionAll');

    if (secSup) secSup.classList.toggle('hidden', subKey !== 'supervisor');
    if (secChef) secChef.classList.toggle('hidden', subKey !== 'chef');
    if (secAdmin) secAdmin.classList.toggle('hidden', subKey !== 'admin');
    if (secAll) secAll.classList.toggle('hidden', subKey !== 'all');

    loadUsersData();
}

function loadUsersData() {
    initUserManagementEvents();

    // 1. Calculate & Render Counts
    const supervisors = usersData.filter(u => u.role === 'supervisor');
    const chefs = usersData.filter(u => u.role === 'chef');
    const admins = usersData.filter(u => u.role === 'admin');
    const totalUsers = usersData.length;

    const bSup = document.getElementById('badgeCountSupervisors');
    if (bSup) bSup.textContent = supervisors.length;
    const bChef = document.getElementById('badgeCountChefs');
    if (bChef) bChef.textContent = chefs.length;
    const bAdm = document.getElementById('badgeCountAdmins');
    if (bAdm) bAdm.textContent = admins.length;
    const bAll = document.getElementById('badgeCountAll');
    if (bAll) bAll.textContent = totalUsers;

    const supCountBadge = document.getElementById('supCountBadge');
    if (supCountBadge) supCountBadge.textContent = `${supervisors.length} Supervisor${supervisors.length === 1 ? '' : 's'}`;

    const adminChefCountBadge = document.getElementById('adminChefCountBadge');
    if (adminChefCountBadge) adminChefCountBadge.textContent = `${chefs.length} Chef${chefs.length === 1 ? '' : 's'}`;

    const adminUserCountBadge = document.getElementById('adminUserCountBadge');
    if (adminUserCountBadge) adminUserCountBadge.textContent = `${admins.length} Admin${admins.length === 1 ? '' : 's'}`;

    const allUsersCountBadge = document.getElementById('allUsersCountBadge');
    if (allUsersCountBadge) allUsersCountBadge.textContent = `${totalUsers} Users`;

    // 2. Render each section
    renderSupervisorsSection(supervisors);
    renderAdminChefsSection(chefs);
    renderAdminsSection(admins);
    renderAllUsersSection(usersData);

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ------------------------------------------------------------
// 1. SUPERVISORS SUBDIVISION
// ------------------------------------------------------------
function renderSupervisorsSection(supervisors) {
    // Populate locations checkboxes
    const cbContainer = document.getElementById('supLocationsCheckboxes');
    if (cbContainer && cbContainer.children.length === 0) {
        let html = `
            <label style="display:flex; align-items:center; gap:8px; font-weight: 600; color: #fff; cursor: pointer; background: rgba(255,255,255,0.04); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                <input type="checkbox" class="sup-loc-cb" value="all" style="accent-color: var(--primary);"> All Locations
            </label>
        `;
        outletsData.forEach(o => {
            html += `
                <label style="display:flex; align-items:center; gap:8px; font-size: 0.85rem; color: #fff; cursor: pointer; background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
                    <input type="checkbox" class="sup-loc-cb" value="${o.id}" style="accent-color: var(--primary);"> ${o.name}
                </label>
            `;
        });
        cbContainer.innerHTML = html;
    }

    const tbody = document.getElementById('supervisorsTableBody');
    if (!tbody) return;

    if (supervisors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">No supervisors registered yet. Use the form to add a supervisor.</td></tr>`;
        return;
    }

    tbody.innerHTML = supervisors.map(s => {
        const locs = s.assignedLocations || [];
        const locBadges = locs.map(l => {
            const outletObj = outletsData.find(o => o.id === l);
            const label = l === 'all' ? 'All Outlets' : (outletObj ? outletObj.name : l.toUpperCase());
            return `<span style="background: rgba(255,190,11,0.12); color: var(--primary); border: 1px solid rgba(255,190,11,0.25); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; margin: 2px; display: inline-block;">${label}</span>`;
        }).join('');

        return `
            <tr>
                <td><strong style="color: var(--text-main); font-size: 0.9rem;">${s.name}</strong></td>
                <td><span style="font-family: monospace; color: var(--text-muted); font-size: 0.82rem;">${s.username}</span></td>
                <td><div>${locBadges || '<span style="color: var(--text-muted);">None</span>'}</div></td>
                <td style="text-align: left; padding-left: 12px; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn btn-outline" onclick="editSupervisorUser('${s.username}')" title="Edit Supervisor" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(255,190,11,0.5); color: var(--primary); background: rgba(255,190,11,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                            <i data-lucide="edit" style="width: 13px; height: 13px;"></i> Edit
                        </button>
                        <button type="button" class="btn btn-outline" onclick="removeSupervisorUser('${s.username}')" title="Remove Supervisor" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(239,71,111,0.5); color: #ef476f; background: rgba(239,71,111,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function saveSupervisorUser() {
    const editUsername = document.getElementById('editSupervisorUsername')?.value;
    const name = document.getElementById('supFullName')?.value.trim();
    const username = document.getElementById('supUsername')?.value.trim();
    const password = document.getElementById('supPassword')?.value.trim();

    const checkedBoxes = document.querySelectorAll('.sup-loc-cb:checked');
    const assignedLocations = Array.from(checkedBoxes).map(cb => cb.value);

    if (!name) {
        window.showToast("Please enter the supervisor's full name.", "warning");
        return;
    }
    if (!username) {
        window.showToast("Please enter a username.", "warning");
        return;
    }
    if (!editUsername && !password) {
        window.showToast("Please enter a password for the new supervisor.", "warning");
        return;
    }
    if (assignedLocations.length === 0) {
        window.showToast("Please assign at least one location/outlet to the supervisor.", "warning");
        return;
    }

    if (editUsername) {
        const sup = usersData.find(u => u.username === editUsername);
        if (sup) {
            sup.name = name;
            sup.username = username;
            if (password) sup.password = password;
            sup.assignedLocations = assignedLocations;
            window.showToast(`Supervisor ${name} updated successfully!`, "success");
        }
    } else {
        if (usersData.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            window.showToast("Username already exists. Please choose another.", "warning");
            return;
        }
        const newSup = {
            username,
            password,
            role: 'supervisor',
            name,
            title: 'Supervisor',
            salary: '-',
            assignedLocations
        };
        usersData.push(newSup);
        window.showToast(`Supervisor ${name} registered successfully!`, "success");
    }

    await saveData();
    resetSupervisorForm();
    loadUsersData();
}

function resetSupervisorForm() {
    document.getElementById('editSupervisorUsername').value = '';
    document.getElementById('supFullName').value = '';
    document.getElementById('supUsername').value = '';
    document.getElementById('supPassword').value = '';
    document.getElementById('supFormTitle').textContent = 'Add New Supervisor';
    document.getElementById('btnCancelEditSupervisor')?.classList.add('hidden');
    document.querySelectorAll('.sup-loc-cb').forEach(cb => cb.checked = false);
}

window.editSupervisorUser = function(username) {
    const sup = usersData.find(u => u.username === username);
    if (!sup) return;

    document.getElementById('editSupervisorUsername').value = sup.username;
    document.getElementById('supFullName').value = sup.name || '';
    document.getElementById('supUsername').value = sup.username || '';
    document.getElementById('supPassword').value = '';
    document.getElementById('supFormTitle').textContent = `Edit Supervisor: ${sup.name}`;
    document.getElementById('btnCancelEditSupervisor')?.classList.remove('hidden');

    const locs = sup.assignedLocations || [];
    document.querySelectorAll('.sup-loc-cb').forEach(cb => {
        cb.checked = locs.includes('all') || locs.includes(cb.value);
    });
};

window.removeSupervisorUser = async function(username) {
    if (currentUser && currentUser.username === username) {
        window.showToast("You cannot remove yourself while logged in.", "warning");
        return;
    }
    const sup = usersData.find(u => u.username === username);
    if (!sup) return;

    const confirmed = await window.showConfirmModal(`Are you sure you want to remove supervisor "${sup.name}" (${sup.username})?`, "Remove Supervisor", {
        danger: true,
        confirmText: "Remove"
    });
    if (!confirmed) return;

    const idx = usersData.findIndex(u => u.username === username);
    if (idx > -1) {
        usersData.splice(idx, 1);
        await saveData();
        loadUsersData();
        window.showToast(`Supervisor ${sup.name} removed.`, "info");
    }
};

// ------------------------------------------------------------
// 2. CHEFS SUBDIVISION (Admin Manage Chefs)
// ------------------------------------------------------------
function renderAdminChefsSection(chefs) {
    // Populate Outlet Select
    const outletSel = document.getElementById('adminChefOutletSelect');
    if (outletSel && outletSel.options.length === 0) {
        outletSel.innerHTML = outletsData.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    }

    // Populate Cuisines Checkboxes
    const cuisinesContainer = document.getElementById('adminChefCuisinesCheckboxes');
    if (cuisinesContainer && cuisinesContainer.children.length === 0) {
        const availableCuisines = cuisinesData.map(c => ({ ...c, icon: '' }));
        cuisinesContainer.innerHTML = availableCuisines.map(c => `
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #fff; cursor: pointer; background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                <input type="checkbox" value="${c.name}" class="admin-chef-cuisine-cb" style="accent-color: var(--primary); cursor: pointer;">
                <span>${c.icon} ${c.name}</span>
            </label>
        `).join('');
    }

    const tbody = document.getElementById('adminChefsTableBody');
    if (!tbody) return;

    if (chefs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No kitchen chefs registered yet. Use the form to add a chef.</td></tr>`;
        return;
    }

    tbody.innerHTML = chefs.map(c => {
        const outletId = (c.assignedLocations && c.assignedLocations[0]) || 'brigade';
        const outletObj = outletsData.find(o => o.id === outletId);
        const outletName = outletObj ? outletObj.name : outletId.toUpperCase();

        const cuisines = c.assignedSections || c.assignedCuisines || ['Indian'];
        const cuisinesBadges = cuisines.map(cs => `<span style="background: rgba(255,190,11,0.12); color: var(--primary); border: 1px solid rgba(255,190,11,0.25); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; margin: 2px; display: inline-block;">${cs}</span>`).join('');

        return `
            <tr>
                <td><strong style="color: var(--text-main); font-size: 0.9rem;">${c.name}</strong></td>
                <td><span style="font-family: monospace; color: var(--text-muted); font-size: 0.82rem;">${c.username}</span></td>
                <td><span style="color: var(--primary); font-weight: 600; font-size: 0.82rem;">${outletName}</span></td>
                <td><div>${cuisinesBadges}</div></td>
                <td style="text-align: left; padding-left: 12px; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn btn-outline" onclick="editAdminChefUser('${c.username}')" title="Edit Chef" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(255,190,11,0.5); color: var(--primary); background: rgba(255,190,11,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                            <i data-lucide="edit" style="width: 13px; height: 13px;"></i> Edit
                        </button>
                        <button type="button" class="btn btn-outline" onclick="removeAdminChefUser('${c.username}')" title="Remove Chef" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(239,71,111,0.5); color: #ef476f; background: rgba(239,71,111,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function saveAdminChefUser() {
    const editUsername = document.getElementById('editAdminChefUsername')?.value;
    const name = document.getElementById('adminChefFullName')?.value.trim();
    const username = document.getElementById('adminChefUsername')?.value.trim();
    const password = document.getElementById('adminChefPassword')?.value.trim();
    const outletId = document.getElementById('adminChefOutletSelect')?.value || 'brigade';

    const checkedBoxes = document.querySelectorAll('.admin-chef-cuisine-cb:checked');
    const selectedCuisines = Array.from(checkedBoxes).map(cb => cb.value);

    if (!name) {
        window.showToast("Please enter the chef's full name.", "warning");
        return;
    }
    if (!username) {
        window.showToast("Please enter a username.", "warning");
        return;
    }
    if (!editUsername && !password) {
        window.showToast("Please enter a password for the new chef.", "warning");
        return;
    }
    if (selectedCuisines.length === 0) {
        window.showToast("Please assign at least one cuisine section to the chef.", "warning");
        return;
    }

    if (editUsername) {
        const chef = usersData.find(u => u.username === editUsername);
        if (chef) {
            chef.name = name;
            chef.username = username;
            if (password) chef.password = password;
            chef.assignedLocations = [outletId];
            chef.assignedSections = selectedCuisines;
            chef.assignedCuisines = selectedCuisines;
            window.showToast(`Chef ${name} updated successfully!`, "success");
        }
    } else {
        if (usersData.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            window.showToast("Username already exists. Please choose another.", "warning");
            return;
        }
        const newChef = {
            username,
            password,
            role: 'chef',
            name,
            title: 'Store Chef',
            salary: '-',
            assignedLocations: [outletId],
            addedBySupervisor: 'Administrator',
            assignedSections: selectedCuisines,
            assignedCuisines: selectedCuisines
        };
        usersData.push(newChef);
        window.showToast(`Chef ${name} registered successfully!`, "success");
    }

    await saveData();
    resetAdminChefForm();
    loadUsersData();
    if (typeof renderChefsTable === 'function') renderChefsTable();
}

function resetAdminChefForm() {
    document.getElementById('editAdminChefUsername').value = '';
    document.getElementById('adminChefFullName').value = '';
    document.getElementById('adminChefUsername').value = '';
    document.getElementById('adminChefPassword').value = '';
    document.getElementById('adminChefFormTitle').textContent = 'Add Kitchen Chef';
    document.getElementById('btnCancelEditAdminChef')?.classList.add('hidden');
    document.querySelectorAll('.admin-chef-cuisine-cb').forEach(cb => cb.checked = false);
}

window.editAdminChefUser = function(username) {
    const chef = usersData.find(u => u.username === username);
    if (!chef) return;

    document.getElementById('editAdminChefUsername').value = chef.username;
    document.getElementById('adminChefFullName').value = chef.name || '';
    document.getElementById('adminChefUsername').value = chef.username || '';
    document.getElementById('adminChefPassword').value = '';
    document.getElementById('adminChefFormTitle').textContent = `Edit Chef: ${chef.name}`;
    document.getElementById('btnCancelEditAdminChef')?.classList.remove('hidden');

    const outletSel = document.getElementById('adminChefOutletSelect');
    const chefOutlet = (chef.assignedLocations && chef.assignedLocations[0]) || 'brigade';
    if (outletSel) outletSel.value = chefOutlet;

    const cuisines = chef.assignedSections || chef.assignedCuisines || [];
    document.querySelectorAll('.admin-chef-cuisine-cb').forEach(cb => {
        cb.checked = cuisines.includes(cb.value);
    });
};

window.removeAdminChefUser = async function(username) {
    const chef = usersData.find(u => u.username === username);
    if (!chef) return;

    const confirmed = await window.showConfirmModal(`Are you sure you want to remove chef "${chef.name}" (${chef.username})?`, "Remove Chef", {
        danger: true,
        confirmText: "Remove"
    });
    if (!confirmed) return;

    const idx = usersData.findIndex(u => u.username === username);
    if (idx > -1) {
        usersData.splice(idx, 1);
        await saveData();
        loadUsersData();
        if (typeof renderChefsTable === 'function') renderChefsTable();
        window.showToast(`Chef ${chef.name} removed.`, "info");
    }
};

// ------------------------------------------------------------
// 3. ADMINS SUBDIVISION
// ------------------------------------------------------------
function renderAdminsSection(admins) {
    const tbody = document.getElementById('adminsTableBody');
    if (!tbody) return;

    if (admins.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">No administrators registered yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = admins.map(a => `
        <tr>
            <td><strong style="color: var(--text-main); font-size: 0.9rem;">${a.name}</strong></td>
            <td><span style="font-family: monospace; color: var(--text-muted); font-size: 0.82rem;">${a.username}</span></td>
            <td><span style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">Full System Access</span></td>
            <td style="text-align: left; padding-left: 12px; white-space: nowrap;">
                <div style="display: inline-flex; align-items: center; gap: 8px;">
                    <button type="button" class="btn btn-outline" onclick="editAdminUser('${a.username}')" title="Edit Admin" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(255,190,11,0.5); color: var(--primary); background: rgba(255,190,11,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                        <i data-lucide="edit" style="width: 13px; height: 13px;"></i> Edit
                    </button>
                    <button type="button" class="btn btn-outline" onclick="removeAdminUser('${a.username}')" title="Remove Admin" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(239,71,111,0.5); color: #ef476f; background: rgba(239,71,111,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function saveAdminUser() {
    const editUsername = document.getElementById('editAdminUserUsername')?.value;
    const name = document.getElementById('adminUserFullName')?.value.trim();
    const username = document.getElementById('adminUserUsername')?.value.trim();
    const password = document.getElementById('adminUserPassword')?.value.trim();

    if (!name) {
        window.showToast("Please enter the administrator's full name.", "warning");
        return;
    }
    if (!username) {
        window.showToast("Please enter a username.", "warning");
        return;
    }
    if (!editUsername && !password) {
        window.showToast("Please enter a password for the new admin.", "warning");
        return;
    }

    if (editUsername) {
        const admin = usersData.find(u => u.username === editUsername);
        if (admin) {
            admin.name = name;
            admin.username = username;
            if (password) admin.password = password;
            window.showToast(`Admin ${name} updated successfully!`, "success");
        }
    } else {
        if (usersData.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            window.showToast("Username already exists. Please choose another.", "warning");
            return;
        }
        const newAdmin = {
            username,
            password,
            role: 'admin',
            name,
            title: 'Administrator',
            salary: '-',
            assignedLocations: ['all']
        };
        usersData.push(newAdmin);
        window.showToast(`Admin ${name} registered successfully!`, "success");
    }

    await saveData();
    resetAdminUserForm();
    loadUsersData();
}

function resetAdminUserForm() {
    document.getElementById('editAdminUserUsername').value = '';
    document.getElementById('adminUserFullName').value = '';
    document.getElementById('adminUserUsername').value = '';
    document.getElementById('adminUserPassword').value = '';
    document.getElementById('adminUserFormTitle').textContent = 'Add System Admin';
    document.getElementById('btnCancelEditAdminUser')?.classList.add('hidden');
}

window.editAdminUser = function(username) {
    const admin = usersData.find(u => u.username === username);
    if (!admin) return;

    document.getElementById('editAdminUserUsername').value = admin.username;
    document.getElementById('adminUserFullName').value = admin.name || '';
    document.getElementById('adminUserUsername').value = admin.username || '';
    document.getElementById('adminUserPassword').value = '';
    document.getElementById('adminUserFormTitle').textContent = `Edit Admin: ${admin.name}`;
    document.getElementById('btnCancelEditAdminUser')?.classList.remove('hidden');
};

window.removeAdminUser = async function(username) {
    if (currentUser && currentUser.username === username) {
        window.showToast("You cannot remove yourself while logged in.", "warning");
        return;
    }
    const admin = usersData.find(u => u.username === username);
    if (!admin) return;

    const confirmed = await window.showConfirmModal(`Are you sure you want to remove administrator "${admin.name}" (${admin.username})?`, "Remove Admin", {
        danger: true,
        confirmText: "Remove"
    });
    if (!confirmed) return;

    const idx = usersData.findIndex(u => u.username === username);
    if (idx > -1) {
        usersData.splice(idx, 1);
        await saveData();
        loadUsersData();
        window.showToast(`Admin ${admin.name} removed.`, "info");
    }
};

// ------------------------------------------------------------
// 4. ALL USERS MASTER ROSTER
// ------------------------------------------------------------
function renderAllUsersSection(allUsers) {
    const tbody = document.getElementById('allUsersTableBody');
    if (!tbody) return;

    tbody.innerHTML = allUsers.map(u => {
        let roleBadge = `<span class="status ok" style="text-transform: capitalize;">${u.role}</span>`;
        if (u.role === 'admin') roleBadge = `<span style="background: rgba(46,196,182,0.15); color: #2ec4b6; border: 1px solid rgba(46,196,182,0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">Admin</span>`;
        if (u.role === 'supervisor') roleBadge = `<span style="background: rgba(255,190,11,0.15); color: var(--primary); border: 1px solid rgba(255,190,11,0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">Supervisor</span>`;
        if (u.role === 'chef') roleBadge = `<span style="background: rgba(255,100,50,0.15); color: #ff6432; border: 1px solid rgba(255,100,50,0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">Chef</span>`;

        let details = '';
        if (u.role === 'admin') {
            details = `<span class="text-muted" style="font-size: 0.8rem;">All Outlets (Full Privileges)</span>`;
        } else if (u.role === 'supervisor') {
            const locs = (u.assignedLocations || []).map(l => {
                const outletObj = outletsData.find(o => o.id === l);
                return l === 'all' ? 'All Outlets' : (outletObj ? outletObj.name : l.toUpperCase());
            }).join(', ');
            details = `<span style="color: var(--text-muted); font-size: 0.8rem;">Outlets: ${locs || 'None'}</span>`;
        } else if (u.role === 'chef') {
            const outletId = (u.assignedLocations && u.assignedLocations[0]) || 'brigade';
            const outletObj = outletsData.find(o => o.id === outletId);
            const outletName = outletObj ? outletObj.name : outletId.toUpperCase();
            const cuisines = (u.assignedSections || u.assignedCuisines || []).join(', ');
            details = `
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                    Outlet: <span style="color: var(--primary); font-weight: 500;">${outletName}</span> &bull; 
                    Cuisines: <span style="color: #fff;">${cuisines || 'All'}</span>
                </div>
            `;
        }

        const editFn = u.role === 'supervisor' ? `editSupervisorUser('${u.username}')` : (u.role === 'chef' ? `editAdminChefUser('${u.username}')` : `editAdminUser('${u.username}')`);
        const removeFn = u.role === 'supervisor' ? `removeSupervisorUser('${u.username}')` : (u.role === 'chef' ? `removeAdminChefUser('${u.username}')` : `removeAdminUser('${u.username}')`);

        return `
            <tr>
                <td><strong style="color: var(--text-main); font-size: 0.9rem;">${u.name}</strong></td>
                <td><span style="font-family: monospace; color: var(--text-muted); font-size: 0.82rem;">${u.username}</span></td>
                <td>${roleBadge}</td>
                <td>${details}</td>
                <td style="text-align: left; padding-left: 12px; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn btn-outline" onclick="${editFn}" title="Edit User" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(255,190,11,0.5); color: var(--primary); background: rgba(255,190,11,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                            <i data-lucide="edit" style="width: 13px; height: 13px;"></i> Edit
                        </button>
                        <button type="button" class="btn btn-outline" onclick="${removeFn}" title="Remove User" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(239,71,111,0.5); color: #ef476f; background: rgba(239,71,111,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// SUPERVISOR CHEF MANAGEMENT (Add Chef)
// ============================================================
function loadAddChefView() {
    const supervisorInput = document.getElementById('chefSupervisorDisplay');
    const supervisorSelect = document.getElementById('chefSupervisorSelect');
    const outletInput = document.getElementById('chefOutletDisplay');
    
    const visibleOutlets = (typeof getVisibleOutlets === 'function') ? getVisibleOutlets() : outletsData;
    const currentOutlet = (visibleOutlets && visibleOutlets.length > 0) ? visibleOutlets[0] : (outletsData[0] || { id: 'brigade', name: 'BRIGADE' });
    if (outletInput) {
        outletInput.value = currentOutlet.name || 'BRIGADE';
        outletInput.dataset.outletId = currentOutlet.id || 'brigade';
    }

    // Check supervisors for this outlet
    const outletSupervisors = usersData.filter(u => 
        u.role === 'supervisor' && 
        (u.assignedLocations && (u.assignedLocations.includes(currentOutlet.id) || u.assignedLocations.includes('all')))
    );

    if (outletSupervisors.length > 1) {
        // Multiple supervisors exist for this outlet -> show dropdown
        if (supervisorInput) supervisorInput.classList.add('hidden');
        if (supervisorSelect) {
            supervisorSelect.classList.remove('hidden');
            supervisorSelect.innerHTML = outletSupervisors.map(s => 
                `<option value="${s.name}" ${(currentUser && currentUser.name === s.name) ? 'selected' : ''}>${s.name} (${s.username})</option>`
            ).join('');
        }
    } else {
        // Only one (or 0) supervisor -> show default
        if (supervisorSelect) supervisorSelect.classList.add('hidden');
        if (supervisorInput) {
            supervisorInput.classList.remove('hidden');
            const defaultName = (outletSupervisors.length === 1) ? outletSupervisors[0].name : (currentUser ? currentUser.name : 'Supervisor');
            supervisorInput.value = defaultName;
        }
    }

    // Populate Cuisines Checkboxes
    const cuisinesContainer = document.getElementById('chefCuisinesCheckboxes');
    if (cuisinesContainer && cuisinesContainer.children.length === 0) {
        const availableCuisines = cuisinesData.map(c => ({ ...c, icon: '' }));

        cuisinesContainer.innerHTML = availableCuisines.map(c => `
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #fff; cursor: pointer; background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                <input type="checkbox" value="${c.name}" class="chef-cuisine-cb" style="accent-color: var(--primary); cursor: pointer;">
                <span>${c.icon} ${c.name}</span>
            </label>
        `).join('');
    }

    renderChefsTable();
}

function renderChefsTable() {
    const tbody = document.getElementById('chefsTableBody');
    if (!tbody) return;

    const visibleOutlets = (typeof getVisibleOutlets === 'function') ? getVisibleOutlets().map(o => o.id) : [];
    const allChefs = usersData.filter(u => u.role === 'chef');
    
    let outletChefs = allChefs;
    if (currentUser && currentUser.role === 'supervisor') {
        outletChefs = allChefs.filter(c => {
            if (c.addedBySupervisor === currentUser.name) return true;
            if (c.assignedLocations && c.assignedLocations.some(loc => visibleOutlets.includes(loc) || loc === 'all')) return true;
            return false;
        });
    }

    const badge = document.getElementById('chefCountBadge');
    if (badge) badge.textContent = `${outletChefs.length} Chef${outletChefs.length === 1 ? '' : 's'}`;

    if (outletChefs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 28px;">No chefs registered yet. Use the form to add your kitchen chefs.</td></tr>`;
        return;
    }

    tbody.innerHTML = outletChefs.map(chef => {
        const cuisines = chef.assignedSections || chef.assignedCuisines || ['Indian'];
        const cuisinesBadges = cuisines.map(cs => `<span style="background: rgba(255,190,11,0.12); color: var(--primary); border: 1px solid rgba(255,190,11,0.25); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; margin: 2px; display: inline-block;">${cs}</span>`).join('');

        return `
            <tr>
                <td><strong style="color: var(--text-main); font-size: 0.9rem;">${chef.name}</strong></td>
                <td><span style="font-family: monospace; color: var(--text-muted); font-size: 0.82rem;">${chef.username}</span></td>
                <td><div>${cuisinesBadges}</div></td>
                <td style="text-align: left; padding-left: 12px; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn btn-outline" onclick="editChefUser('${chef.username}')" title="Edit Chef" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(255,190,11,0.5); color: var(--primary); background: rgba(255,190,11,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                            <i data-lucide="edit" style="width: 13px; height: 13px;"></i> Edit
                        </button>
                        <button type="button" class="btn btn-outline" onclick="removeChefUser('${chef.username}')" title="Remove Chef" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(239,71,111,0.5); color: #ef476f; background: rgba(239,71,111,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveChefUser() {
    const editUsername = document.getElementById('editChefUsername')?.value;
    const name = document.getElementById('chefFullName')?.value.trim();
    const username = document.getElementById('chefUsername')?.value.trim();
    const password = document.getElementById('chefPassword')?.value.trim();
    
    const supervisorSelect = document.getElementById('chefSupervisorSelect');
    const supervisorDisplay = document.getElementById('chefSupervisorDisplay');
    let supervisorName = currentUser ? currentUser.name : 'Supervisor';
    if (supervisorSelect && !supervisorSelect.classList.contains('hidden') && supervisorSelect.value) {
        supervisorName = supervisorSelect.value;
    } else if (supervisorDisplay && supervisorDisplay.value) {
        supervisorName = supervisorDisplay.value;
    }
    
    const outletInput = document.getElementById('chefOutletDisplay');
    const outletId = (outletInput && outletInput.dataset.outletId) ? outletInput.dataset.outletId : primaryOutlet.id;

    if (!name) {
        window.showToast("Please enter the chef's full name.", "warning");
        return;
    }
    if (!username) {
        window.showToast("Please enter a username for the chef.", "warning");
        return;
    }
    if (!editUsername && !password) {
        window.showToast("Please provide a password for the chef.", "warning");
        return;
    }

    const checkedBoxes = document.querySelectorAll('.chef-cuisine-cb:checked');
    const selectedCuisines = Array.from(checkedBoxes).map(cb => cb.value);
    if (selectedCuisines.length === 0) {
        window.showToast("Please assign at least one cuisine section to the chef.", "warning");
        return;
    }

    if (editUsername) {
        const existingChef = usersData.find(u => u.username === editUsername);
        if (existingChef) {
            existingChef.name = name;
            existingChef.username = username;
            if (password) existingChef.password = password;
            existingChef.assignedSections = selectedCuisines;
            existingChef.assignedCuisines = selectedCuisines;
            existingChef.addedBySupervisor = supervisorName;
            window.showToast(`Chef ${name} updated successfully!`, "success");
        }
    } else {
        if (usersData.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            window.showToast("A user with this username already exists. Choose a different username.", "warning");
            return;
        }

        const newChef = {
            username: username,
            password,
            role: 'chef',
            name: name,
            title: 'Store Chef',
            salary: '-',
            assignedLocations: [outletId],
            assignedSections: selectedCuisines,
            assignedCuisines: selectedCuisines,
            addedBySupervisor: supervisorName
        };
        usersData.push(newChef);
        window.showToast(`Chef ${name} registered successfully!`, "success");
    }

    await saveData();
    resetChefForm();
    renderChefsTable();
    if (typeof loadUsersData === 'function') loadUsersData();
}

function resetChefForm() {
    document.getElementById('editChefUsername').value = '';
    document.getElementById('chefFullName').value = '';
    document.getElementById('chefUsername').value = '';
    document.getElementById('chefPassword').value = '';
    document.getElementById('chefFormTitle').textContent = 'Add New Chef';
    document.getElementById('btnCancelEditChef')?.classList.add('hidden');
    document.querySelectorAll('.chef-cuisine-cb').forEach(cb => cb.checked = false);
    loadAddChefView();
}

window.editChefUser = function(username) {
    const chef = usersData.find(u => u.username === username);
    if (!chef) return;

    document.getElementById('editChefUsername').value = chef.username;
    document.getElementById('chefFullName').value = chef.name || '';
    document.getElementById('chefUsername').value = chef.username || '';
    document.getElementById('chefPassword').value = '';
    document.getElementById('chefFormTitle').textContent = `Edit Chef: ${chef.name}`;
    document.getElementById('btnCancelEditChef')?.classList.remove('hidden');

    const supSel = document.getElementById('chefSupervisorSelect');
    const supDis = document.getElementById('chefSupervisorDisplay');
    if (supSel && !supSel.classList.contains('hidden') && chef.addedBySupervisor) {
        supSel.value = chef.addedBySupervisor;
    } else if (supDis && chef.addedBySupervisor) {
        supDis.value = chef.addedBySupervisor;
    }

    const cuisines = chef.assignedSections || chef.assignedCuisines || [];
    document.querySelectorAll('.chef-cuisine-cb').forEach(cb => {
        cb.checked = cuisines.includes(cb.value);
    });
};

window.removeChefUser = async function(username) {
    const chef = usersData.find(u => u.username === username);
    if (!chef) return;

    const confirmed = await window.showConfirmModal(`Are you sure you want to remove chef "${chef.name}" (${chef.username})?`, "Remove Chef", {
        type: 'danger',
        confirmText: 'Remove'
    });
    if (confirmed) {
        const idx = usersData.findIndex(u => u.username === username);
        if (idx !== -1) {
            usersData.splice(idx, 1);
            await saveData();
            renderChefsTable();
            if (typeof loadUsersData === 'function') loadUsersData();
            window.showToast(`Chef ${chef.name} removed`, 'info');
        }
    }
};

window.loadAddChefView = loadAddChefView;
window.renderChefsTable = renderChefsTable;
window.saveChefUser = saveChefUser;
window.resetChefForm = resetChefForm;

function loadLocationsData() {
    const tbody = document.getElementById('locationsTableBody');
    if (!tbody) return;

    const badge = document.getElementById('locationsCountBadge');
    if (badge) badge.textContent = `${outletsData.length} Location${outletsData.length === 1 ? '' : 's'}`;

    if (outletsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 24px;">No locations configured yet. Use the form below to add a location.</td></tr>`;
        return;
    }

    tbody.innerHTML = outletsData.map(o => `
        <tr>
            <td><span style="font-family: monospace; color: var(--text-muted); font-size: 0.85rem;">${o.id}</span></td>
            <td><strong style="color: var(--primary); font-size: 0.92rem;">${o.name}</strong></td>
            <td style="text-align: left; padding-left: 12px; white-space: nowrap;">
                <div style="display: inline-flex; align-items: center; gap: 8px;">
                    <button type="button" class="btn btn-outline" onclick="editLocation('${o.id}')" title="Edit Location" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(255,190,11,0.5); color: var(--primary); background: rgba(255,190,11,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                        <i data-lucide="edit" style="width: 13px; height: 13px;"></i> Edit
                    </button>
                    <button type="button" class="btn btn-outline" onclick="removeLocation('${o.id}')" title="Remove Location" style="padding: 5px 12px; font-size: 0.78rem; border-color: rgba(239,71,111,0.5); color: #ef476f; background: rgba(239,71,111,0.08); border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; cursor: pointer;">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveLocation() {
    const editId = document.getElementById('editLocationId')?.value;
    const id = document.getElementById('newLocationId')?.value.trim();
    const name = document.getElementById('newLocationName')?.value.trim();
    
    if (!id || !name) {
        window.showToast("Location ID and Name are required.", "warning");
        return;
    }
    
    if (editId) {
        const loc = outletsData.find(o => o.id === editId);
        if (loc) {
            loc.id = id;
            loc.name = name;
            window.showToast(`Location ${name} updated successfully!`, "success");
        }
    } else {
        if (outletsData.find(o => o.id.toLowerCase() === id.toLowerCase())) {
            window.showToast("Location ID already exists. Please choose another.", "warning");
            return;
        }
        outletsData.push({ id, name });
        window.showToast(`Location ${name} registered successfully!`, "success");
    }
    
    await saveData();
    resetLocationForm();
    loadLocationsData();
    
    // Clear user locations checkboxes so they rebuild with new data
    const cbContainer = document.getElementById('supLocationsCheckboxes');
    if (cbContainer) cbContainer.innerHTML = '';
}

function resetLocationForm() {
    document.getElementById('locationFormTitle').textContent = 'Add Location';
    document.getElementById('editLocationId').value = '';
    document.getElementById('newLocationId').value = '';
    document.getElementById('newLocationName').value = '';
    document.getElementById('cancelEditLocationBtn')?.classList.add('hidden');
}

window.editLocation = function(id) {
    const loc = outletsData.find(o => o.id === id);
    if (!loc) return;
    
    document.getElementById('locationFormTitle').textContent = `Edit Location: ${loc.name}`;
    document.getElementById('editLocationId').value = loc.id;
    document.getElementById('newLocationId').value = loc.id;
    document.getElementById('newLocationName').value = loc.name;
    document.getElementById('cancelEditLocationBtn')?.classList.remove('hidden');
    document.getElementById('newLocationName')?.focus();
};

window.removeLocation = async function(id) {
    const loc = outletsData.find(o => o.id === id);
    if (!loc) return;

    const confirmed = await window.showConfirmModal(`Are you sure you want to remove location "${loc.name}" (${loc.id})?`, "Remove Location", {
        danger: true,
        confirmText: "Remove"
    });
    if (!confirmed) return;
    
    const idx = outletsData.findIndex(o => o.id === id);
    if (idx > -1) {
        outletsData.splice(idx, 1);
        await saveData();
        loadLocationsData();
        
        // Clear user locations checkboxes so they rebuild with new data
        const cbContainer = document.getElementById('supLocationsCheckboxes');
        if (cbContainer) cbContainer.innerHTML = '';
        window.showToast(`Location ${loc.name} removed.`, "info");
    }
};
