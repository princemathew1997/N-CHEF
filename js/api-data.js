// D1 is authoritative. Browser storage is used only for view preferences.
const outletsData = [];
const usersData = [];
const vendorsData = [];
let masterItemsData = [];
const requestsData = [];
const indentsData = [];
const purchaseOrdersData = [];
const cuisinesData = [];
let committedState = null;
let databaseWritePending = false;
let successNotifications = [];
const collectionMap = { outlets: outletsData, users: usersData, vendors: vendorsData, items: masterItemsData, requests: requestsData, indents: indentsData, purchase_orders: purchaseOrdersData, cuisines: cuisinesData };
const copyData = value => JSON.parse(JSON.stringify(value));

async function apiRequest(path, method = 'GET', value) {
    const res = await fetch('/api/' + path, {
        method, credentials: 'same-origin', cache: 'no-store',
        headers: { ...(value ? { 'Content-Type': 'application/json' } : {}), ...(window.NCHEF_RELEASE?.commit ? { 'X-NCHEF-Client-Release': window.NCHEF_RELEASE.commit } : {}) },
        body: value ? JSON.stringify(value) : undefined
    });
    let data;
    try { data = await res.json(); } catch { throw new Error('Cannot connect to the database API. Run the app with npm start.'); }
    if (!res.ok) {
        const error = new Error(data.error || 'Database request failed.');
        error.status = res.status;
        error.details = data.errors;
        throw error;
    }
    return data;
}
function applyServerState(state) {
    for (const [entity, target] of Object.entries(collectionMap)) {
        target.length = 0;
        target.push(...copyData(state[entity] || []));
    }
    committedState = copyData(state);
    window.liveCatalogReference = null;
    if(typeof currentUser!=='undefined' && currentUser){
        if(typeof updateRequestsBadge==='function')updateRequestsBadge();
        if(typeof updateIndentsBadge==='function')updateIndentsBadge();
    }
}
function reloadDataFromStorage() { /* Kept for legacy view callbacks; never read business localStorage. */ }
function getItemTotalQty(item) { return Object.values(item.allocations || {}).reduce((sum, q) => sum + q, 0); }
function getItemStatus(item) {
    const balance = (item.bought || 0) - getItemTotalQty(item);
    if (!item.bought) return 'Pending PO';
    if (balance <= 5) return 'Low Stock';
    return balance > 20 ? 'In Stock' : 'Allocated/Pending PO';
}
function pendingChanges() {
    if (!committedState) return [];
    const changes = [];
    for (const [entity, values] of Object.entries(collectionMap)) {
        if (entity === 'cuisines') continue;
        const old = new Map(committedState[entity].map(row => [row.id, row]));
        for (const row of values) {
            if (!row.id) row.id = crypto.randomUUID();
            if (entity === 'requests' && !old.has(row.id) && !row.cuisine) row.cuisine = currentUser?.assignedSections?.[0] || cuisinesData[0]?.name;
            if (JSON.stringify(row) !== JSON.stringify(old.get(row.id))) changes.push({ entity, key: row.id, value: copyData(row) });
            old.delete(row.id);
        }
        for (const key of old.keys()) changes.push({ entity, key, value: null });
    }
    return changes;
}
window.deferDatabaseSuccess = (message, type) => {
    if (type === 'success' && committedState && (databaseWritePending || pendingChanges().length)) {
        successNotifications.push({ message, type });
        return true;
    }
    return false;
};
async function saveData() {
    if (!committedState) throw new Error('Sign in before saving.');
    if (databaseWritePending) throw new Error('A save is already in progress. Wait before making another change.');
    const changes = pendingChanges();
    if (!changes.length) return;
    databaseWritePending = true;
    document.body.classList.add('database-saving');
    try {
        const state = await apiRequest('changes', 'POST', { operationId: crypto.randomUUID(), revision: committedState.revision, changes });
        applyServerState(state);
        const messages = successNotifications;
        successNotifications = [];
        databaseWritePending = false;
        for (const notification of messages) window.showToast?.(notification.message, notification.type);
    } catch (error) {
        successNotifications = [];
        applyServerState(committedState);
        try { applyServerState(await apiRequest('state')); } catch { /* Preserve last confirmed state. */ }
        window.onLiveSyncReceived?.();
        throw error;
    } finally {
        databaseWritePending = false;
        document.body.classList.remove('database-saving');
    }
}
let refreshPending = false;
async function refreshDatabase() {
    if (!currentUser || !committedState || databaseWritePending || document.hidden || refreshPending) return;
    refreshPending = true;
    try {
        const revision = await apiRequest('revision');
        if(revision.revision === committedState.revision) return;
        const state = await apiRequest('state');
        if(databaseWritePending || state.revision<=committedState.revision) return;
        if(pendingChanges().length) {
            window.liveCatalogReference = copyData(state.items);
            window.dispatchEvent(new CustomEvent('catalog-refreshed'));
            return;
        }
        applyServerState(state);
        const refreshed = usersData.find(u => u.id === currentUser.id);
        if(refreshed) { const changed=refreshed.role!==currentUser.role;currentUser=refreshed;if(changed)window.applyLoggedInUser(currentUser); }
        window.onLiveSyncReceived?.();
        window.dispatchEvent(new CustomEvent('catalog-refreshed'));
    } catch(error) { if(error.status===401)window.location.reload(); }
    finally { refreshPending=false; }
}

async function runDatabaseAction(path, input) {
    if (!committedState || databaseWritePending) throw new Error('Wait for the current save to finish.');
    if (pendingChanges().length) throw new Error('Finish or refresh the current edit before this action.');
    databaseWritePending = true;
    document.body.classList.add('database-saving');
    try {
        applyServerState(await apiRequest(path, 'POST', { ...input, revision: committedState.revision, operationId: crypto.randomUUID() }));
        window.onLiveSyncReceived?.();
    } catch (error) {
        try { applyServerState(await apiRequest('state')); window.onLiveSyncReceived?.(); } catch { /* Keep confirmed data. */ }
        throw error;
    } finally { databaseWritePending = false; document.body.classList.remove('database-saving'); }
}
window.saveUser = async function() {
    const username = document.getElementById('newUserUsername').value.trim();
    const name = document.getElementById('newUserName')?.value.trim() || username;
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const edit = document.getElementById('editUsername').value;
    const locations = Array.from(document.querySelectorAll('.location-checkbox:checked')).map(cb => cb.value);
    const sections = Array.from(document.querySelectorAll('.section-checkbox:checked')).map(cb => cb.value);
    const existing = usersData.find(u => u.username === edit);
    const value = { ...(existing || {}), id: existing?.id || crypto.randomUUID(), username, name, role, title: role, assignedLocations: role === 'admin' ? ['all'] : locations, assignedSections: sections, assignedCuisines: sections };
    if (password) value.password = password;
    if (existing) Object.assign(existing, value); else usersData.push(value);
    await saveData();
    window.loadUsersData?.();
};
document.addEventListener('keydown', event => {
    if (databaseWritePending) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
setInterval(refreshDatabase, 3000);
window.addEventListener('focus',refreshDatabase);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDatabase();});
document.addEventListener('focusin',e=>{if(e.target.matches('select,[role=combobox]'))refreshDatabase();});
window.addEventListener('unhandledrejection', event => {
    event.preventDefault();
    window.showUiModal?.({ title: 'Change was not saved', message: event.reason?.message || 'Please refresh and try again.', type: 'warning' });
});
window.resetToDemoData = () => window.showUiModal?.({ title: 'Demo reset unavailable', message: 'This app uses the shared database. Demo data cannot be restored here.', type: 'warning' });
