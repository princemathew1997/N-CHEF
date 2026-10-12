// ============================================================
// DATA - n.chef Kitchen Tracker System
// ============================================================

const defaultOutlets = [
    { id: 'brigade', name: 'BRIGADE' },
    { id: 'vidyaranyapura', name: 'VIDYARANYAPURA' },
    { id: 'yelahanka', name: 'YELAHANKA' },
    { id: 'ms-palya', name: 'MS PALYA' }
];

const outletsData = JSON.parse(localStorage.getItem('nchef_outlets')) || [];
if (outletsData.length === 0) {
    outletsData.push(...defaultOutlets);
}
const primaryOutlet = outletsData[0] || defaultOutlets[0];

const usersData = JSON.parse(localStorage.getItem('nchef_users')) || [
    {
        username: 'admin',
        password: '123',
        role: 'admin',
        name: 'System Admin',
        title: 'Administrator',
        salary: '-',
        assignedLocations: ['all'] 
    },
    {
        username: 'chef',
        password: '123',
        role: 'chef',
        name: 'Prince',
        title: 'Store Chef',
        salary: '-',
        assignedLocations: ['all']
    },
    {
        username: 'supervisor',
        password: '123',
        role: 'supervisor',
        name: 'Supervisor',
        title: 'Supervisor',
        salary: '-',
        assignedLocations: [primaryOutlet.id]
    }
];

// Ensure supervisor user exists and has a valid assigned outlet from outletsData
let supervisorUser = usersData.find(u => u.username === 'supervisor');
if (!supervisorUser) {
    supervisorUser = {
        username: 'supervisor',
        password: '123',
        role: 'supervisor',
        name: 'Supervisor',
        title: 'Supervisor',
        salary: '-',
        assignedLocations: [primaryOutlet.id]
    };
    usersData.push(supervisorUser);
} else {
    // If supervisor's assigned location doesn't match any real outlet in outletsData, fix it to primary outlet
    if (!supervisorUser.assignedLocations || supervisorUser.assignedLocations.length === 0 || !supervisorUser.assignedLocations.some(id => id === 'all' || outletsData.some(o => o.id === id))) {
        supervisorUser.assignedLocations = [primaryOutlet.id];
    }
}

// Ensure chef users have assignedSections/assignedCuisines
usersData.forEach(u => {
    if (u.role === 'chef' && (!u.assignedSections || u.assignedSections.length === 0)) {
        u.assignedSections = ['Indian'];
        u.assignedCuisines = ['Indian'];
    }
});

const defaultVendors = [
    { id: 'v_01', name: 'Fresh Farms Produce Ltd' },
    { id: 'v_02', name: 'Metro Food Distributors' },
    { id: 'v_03', name: 'Prime Meats & Seafood' },
    { id: 'v_04', name: 'Global Dairy Supplies' }
];
const vendorsData = JSON.parse(localStorage.getItem('nchef_vendors')) || [];
if (vendorsData.length === 0) {
    vendorsData.push(...defaultVendors);
}
let masterItemsData = JSON.parse(localStorage.getItem('nchef_items')) || [];
const requestsData = JSON.parse(localStorage.getItem('nchef_requests')) || [];
const indentsData = JSON.parse(localStorage.getItem('nchef_indents')) || [];
const purchaseOrdersData = JSON.parse(localStorage.getItem('nchef_purchase_orders')) || [];

// Normalize any requests with legacy/missing outletId or outletName
requestsData.forEach(r => {
    if (!r.outletId || r.outletId === 'o_01') {
        r.outletId = primaryOutlet.id;
        r.outletName = primaryOutlet.name;
    }
    if (!r.outletName) {
        const found = outletsData.find(o => o.id === r.outletId);
        r.outletName = found ? found.name : primaryOutlet.name;
    }
    if (!r.chefName && r.requestedBy) {
        r.chefName = r.requestedBy;
    }
});

// Normalize any indents with missing or undefined dates
indentsData.forEach(ind => {
    if (!ind.date || ind.date === 'undefined') {
        if (ind.createdAt) {
            try {
                const d = new Date(ind.createdAt);
                if (!isNaN(d.getTime())) {
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    ind.date = `${day}/${month}/${year}`;
                } else {
                    ind.date = new Date().toLocaleDateString();
                }
            } catch(e) {
                ind.date = new Date().toLocaleDateString();
            }
        } else {
            ind.date = new Date().toLocaleDateString();
        }
    }
});

// Auto-link any requests marked 'Sent to Admin' or 'Consolidated' into a consolidated supervisor request if missing
const pendingForwardedReqs = requestsData.filter(r => (r.status === 'Sent to Admin' || r.status === 'Consolidated') && !r.indentId);
if (pendingForwardedReqs.length > 0) {
    const groupedByOutlet = {};
    pendingForwardedReqs.forEach(r => {
        const oId = r.outletId || primaryOutlet.id;
        if (!groupedByOutlet[oId]) groupedByOutlet[oId] = [];
        groupedByOutlet[oId].push(r);
    });

    Object.keys(groupedByOutlet).forEach(oId => {
        const reqs = groupedByOutlet[oId];
        const outletName = reqs[0].outletName || primaryOutlet.name;
        const indentId = 'ind_synced_' + oId;
        const indentNumber = 'REQ-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);
        
        const itemMap = {};
        reqs.forEach(r => {
            const mItem = masterItemsData.find(i => i.id === r.itemId) || { name: r.itemName, category: 'General', unit: r.unit || 'kg' };
            if (!itemMap[r.itemId]) {
                itemMap[r.itemId] = {
                    itemId: r.itemId,
                    itemName: r.itemName || mItem.name,
                    category: mItem.category || 'Kitchen Ingredients',
                    unit: r.unit || mItem.unit || 'units',
                    originalQty: 0,
                    revisedQty: 0,
                    comment: r.supervisorNote || '',
                    cuisineBreakdown: []
                };
            }
            const q = parseFloat(r.qty) || 0;
            itemMap[r.itemId].originalQty += q;
            itemMap[r.itemId].revisedQty += (parseFloat(r.revisedQty) || q);
            itemMap[r.itemId].cuisineBreakdown.push({
                cuisine: r.cuisine || 'Cuisine Section',
                chef: r.chefName || r.requestedBy || 'Chef',
                qty: q
            });
            r.indentId = indentId;
        });

        if (!indentsData.some(i => i.id === indentId)) {
            indentsData.unshift({
                id: indentId,
                indentNumber: indentNumber,
                date: new Date().toLocaleDateString(),
                outletId: oId,
                outletName: outletName,
                supervisorName: 'Supervisor Lora',
                status: 'Pending Approval',
                items: Object.values(itemMap),
                createdAt: new Date().toISOString()
            });
        }
    });
}

const cuisinesData = [
    { id: 'c_01', name: 'Indian' },
    { id: 'c_02', name: 'Continental' },
    { id: 'c_03', name: 'Tandoor' },
    { id: 'c_04', name: 'Chinese' },
    { id: 'c_05', name: 'Arabic' },
    { id: 'c_06', name: 'Kerala' }
];

// Helper to calculate total quantity for an item
function getItemTotalQty(item) {
    let total = 0;
    if (item.allocations) {
        for (let key in item.allocations) {
            total += item.allocations[key];
        }
    }
    return total;
}

// Helper to determine status based on balance
function getItemStatus(item) {
    const allocated = getItemTotalQty(item);
    const balance = (item.bought || 0) - allocated;
    
    if (!item.bought || item.bought === 0) return 'Pending PO';
    if (balance <= 5) return 'Low Stock';
    if (balance > 20) return 'In Stock';
    return 'Allocated/Pending PO';
}

const liveSyncChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('nchef_live_channel') : null;

function reloadDataFromStorage() {
    const rawUsers = localStorage.getItem('nchef_users');
    if (rawUsers) {
        usersData.length = 0;
        usersData.push(...JSON.parse(rawUsers));
    }
    const rawVendors = localStorage.getItem('nchef_vendors');
    if (rawVendors) {
        vendorsData.length = 0;
        vendorsData.push(...JSON.parse(rawVendors));
    }
    const rawOutlets = localStorage.getItem('nchef_outlets');
    if (rawOutlets) {
        outletsData.length = 0;
        outletsData.push(...JSON.parse(rawOutlets));
    }
    const rawItems = localStorage.getItem('nchef_items');
    if (rawItems) {
        masterItemsData.length = 0;
        masterItemsData.push(...JSON.parse(rawItems));
    }
    const rawRequests = localStorage.getItem('nchef_requests');
    if (rawRequests) {
        requestsData.length = 0;
        requestsData.push(...JSON.parse(rawRequests));
    }
    const rawIndents = localStorage.getItem('nchef_indents');
    if (rawIndents) {
        indentsData.length = 0;
        indentsData.push(...JSON.parse(rawIndents));
    }
    const rawPOs = localStorage.getItem('nchef_purchase_orders');
    if (rawPOs) {
        purchaseOrdersData.length = 0;
        purchaseOrdersData.push(...JSON.parse(rawPOs));
    }
}

function broadcastLiveUpdate() {
    if (liveSyncChannel) {
        try {
            liveSyncChannel.postMessage({ action: 'sync', time: Date.now() });
        } catch(e) {}
    }
}

function saveData() {
    localStorage.setItem('nchef_users', JSON.stringify(usersData));
    localStorage.setItem('nchef_vendors', JSON.stringify(vendorsData));
    localStorage.setItem('nchef_outlets', JSON.stringify(outletsData));
    localStorage.setItem('nchef_items', JSON.stringify(masterItemsData));
    localStorage.setItem('nchef_requests', JSON.stringify(requestsData));
    localStorage.setItem('nchef_indents', JSON.stringify(indentsData));
    localStorage.setItem('nchef_purchase_orders', JSON.stringify(purchaseOrdersData));
    broadcastLiveUpdate();
    if (typeof window !== 'undefined' && typeof window.onLiveSyncReceived === 'function') {
        try {
            window.onLiveSyncReceived();
        } catch (e) {
            console.error('Error in local live sync:', e);
        }
    }
}

function initSeedRequests() {
    if (localStorage.getItem('nchef_requests') === null && requestsData.length === 0 && masterItemsData.length > 0) {
        const chickenItem = masterItemsData.find(i => i.name.toLowerCase().includes('chicken')) || masterItemsData[0];
        const outletId = primaryOutlet.id;
        const outletName = primaryOutlet.name;
        
        if (chickenItem) {
            requestsData.push(
                {
                    id: 'req_seed_1',
                    itemId: chickenItem.id,
                    itemName: chickenItem.name,
                    unit: chickenItem.unit || 'kg',
                    outletId: outletId,
                    outletName: outletName,
                    qty: 5,
                    cuisine: 'Tandoor',
                    chefName: 'Chef Prince',
                    requestedBy: 'Chef Prince',
                    status: 'Pending',
                    timestamp: new Date().toISOString()
                },
                {
                    id: 'req_seed_2',
                    itemId: chickenItem.id,
                    itemName: chickenItem.name,
                    unit: chickenItem.unit || 'kg',
                    outletId: outletId,
                    outletName: outletName,
                    qty: 2.5,
                    cuisine: 'Chinese',
                    chefName: 'Chef Li',
                    requestedBy: 'Chef Li',
                    status: 'Pending',
                    timestamp: new Date().toISOString()
                },
                {
                    id: 'req_seed_3',
                    itemId: chickenItem.id,
                    itemName: chickenItem.name,
                    unit: chickenItem.unit || 'kg',
                    outletId: outletId,
                    outletName: outletName,
                    qty: 2.5,
                    cuisine: 'Arabic',
                    chefName: 'Chef Tariq',
                    requestedBy: 'Chef Tariq',
                    status: 'Pending',
                    timestamp: new Date().toISOString()
                }
            );
        }
        if (tomatoItem) {
            requestsData.push({
                id: 'req_seed_4',
                itemId: tomatoItem.id,
                itemName: tomatoItem.name,
                unit: tomatoItem.unit || 'kg',
                outletId: outletId,
                outletName: outletName,
                qty: 10,
                cuisine: 'Kerala',
                chefName: 'Chef Sasi',
                requestedBy: 'Chef Sasi',
                status: 'Pending',
                timestamp: new Date().toISOString()
            });
        }
    }
    saveData();
}
initSeedRequests();


