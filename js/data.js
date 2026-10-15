// ============================================================
// DATA - n.chef Kitchen Tracker System
// ============================================================

const defaultOutlets = [
    { id: 'brigade', name: 'BRIGADE' },
    { id: 'vidyaranyapura', name: 'VIDYARANYAPURA' },
    { id: 'ms-palya', name: 'MS PALYA' },
    { id: 'yelahanka', name: 'YELAHANKA' },
    { id: 'cafe', name: 'CAFE' }
];

const outletsData = JSON.parse(localStorage.getItem('nchef_outlets')) || [];
if (outletsData.length === 0 || !outletsData.some(o => o.id === 'cafe')) {
    outletsData.length = 0;
    outletsData.push(...defaultOutlets);
    localStorage.setItem('nchef_outlets', JSON.stringify(outletsData));
}
const primaryOutlet = outletsData[0] || defaultOutlets[0];

const defaultUsers = [
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
        username: 'supervisor',
        password: '123',
        role: 'supervisor',
        name: 'Lora Peterson',
        title: 'Outlet Manager',
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
        assignedLocations: ['all'],
        assignedSections: ['Indian', 'Tandoor'],
        assignedCuisines: ['Indian', 'Tandoor']
    },
    {
        username: 'chef_li',
        password: '123',
        role: 'chef',
        name: 'Chef Li',
        title: 'Section Chef',
        salary: '-',
        assignedLocations: ['brigade'],
        assignedSections: ['Chinese'],
        assignedCuisines: ['Chinese'],
        addedBySupervisor: 'Lora Peterson'
    },
    {
        username: 'chef_tariq',
        password: '123',
        role: 'chef',
        name: 'Chef Tariq',
        title: 'Section Chef',
        salary: '-',
        assignedLocations: ['brigade'],
        assignedSections: ['Arabic'],
        assignedCuisines: ['Arabic'],
        addedBySupervisor: 'Lora Peterson'
    },
    {
        username: 'chef_sasi',
        password: '123',
        role: 'chef',
        name: 'Chef Sasi',
        title: 'Section Chef',
        salary: '-',
        assignedLocations: ['brigade'],
        assignedSections: ['Kerala'],
        assignedCuisines: ['Kerala'],
        addedBySupervisor: 'Lora Peterson'
    }
];

const usersData = JSON.parse(localStorage.getItem('nchef_users')) || [];
if (usersData.length === 0 || !usersData.some(u => u.name === 'Lora Peterson')) {
    usersData.length = 0;
    usersData.push(...defaultUsers);
    localStorage.setItem('nchef_users', JSON.stringify(usersData));
}

// Ensure supervisor user exists and has a valid assigned outlet from outletsData
let supervisorUser = usersData.find(u => u.username === 'supervisor');
if (!supervisorUser) {
    supervisorUser = {
        username: 'supervisor',
        password: '123',
        role: 'supervisor',
        name: 'Lora Peterson',
        title: 'Outlet Manager',
        salary: '-',
        assignedLocations: ['all']
    };
    usersData.push(supervisorUser);
}

const defaultVendors = [
    { id: 'v_01', name: 'Hyperpure' },
    { id: 'v_02', name: 'Maruthi' },
    { id: 'v_03', name: 'Prestige' },
    { id: 'v_04', name: 'HVC' }
];
const vendorsData = JSON.parse(localStorage.getItem('nchef_vendors')) || [];
if (vendorsData.length === 0 || !vendorsData.some(v => v.name === 'Hyperpure')) {
    vendorsData.length = 0;
    vendorsData.push(...defaultVendors);
    localStorage.setItem('nchef_vendors', JSON.stringify(vendorsData));
}

const defaultMasterItems = [
    {
        id: 'item_01',
        name: 'Tuna',
        category: 'Dry',
        cuisine: 'Continental',
        vendor: 'Hyperpure',
        unit: 'pcs',
        bought: 100,
        allocations: { 'brigade': 22, 'vidyaranyapura': 30, 'ms-palya': 10, 'yelahanka': 0, 'cafe': 0 },
        consumed: { 'brigade': 5, 'vidyaranyapura': 8, 'ms-palya': 2, 'yelahanka': 0, 'cafe': 0 }
    },
    {
        id: 'item_02',
        name: 'Pasta',
        category: 'Dry',
        cuisine: 'Continental',
        vendor: 'Hyperpure',
        unit: 'kg',
        bought: 50,
        allocations: { 'brigade': 10, 'vidyaranyapura': 5, 'ms-palya': 0, 'yelahanka': 0, 'cafe': 10 },
        consumed: { 'brigade': 2, 'vidyaranyapura': 1, 'ms-palya': 0, 'yelahanka': 0, 'cafe': 3 }
    },
    {
        id: 'item_03',
        name: 'Wheat flour',
        category: 'Dry',
        cuisine: 'Indian',
        vendor: 'Hyperpure',
        unit: 'kg',
        bought: 20,
        allocations: { 'brigade': 0, 'vidyaranyapura': 10, 'ms-palya': 10, 'yelahanka': 0, 'cafe': 0 },
        consumed: { 'brigade': 0, 'vidyaranyapura': 4, 'ms-palya': 4, 'yelahanka': 0, 'cafe': 0 }
    },
    {
        id: 'item_04',
        name: 'Bread flour',
        category: 'Dry',
        cuisine: 'Continental',
        vendor: 'Hyperpure',
        unit: 'kg',
        bought: 25,
        allocations: { 'brigade': 11, 'vidyaranyapura': 0, 'ms-palya': 10, 'yelahanka': 0, 'cafe': 0 },
        consumed: { 'brigade': 3, 'vidyaranyapura': 0, 'ms-palya': 2, 'yelahanka': 0, 'cafe': 0 }
    },
    {
        id: 'item_05',
        name: 'Rice flour',
        category: 'Dry',
        cuisine: 'Kerala',
        vendor: 'Hyperpure',
        unit: 'kg',
        bought: 40,
        allocations: { 'brigade': 11, 'vidyaranyapura': 20, 'ms-palya': 0, 'yelahanka': 0, 'cafe': 0 },
        consumed: { 'brigade': 4, 'vidyaranyapura': 5, 'ms-palya': 0, 'yelahanka': 0, 'cafe': 0 }
    },
    {
        id: 'item_06',
        name: 'Rice milk',
        category: 'Canned',
        cuisine: 'Continental',
        vendor: 'Hyperpure',
        unit: 'L',
        bought: 30,
        allocations: { 'brigade': 0, 'vidyaranyapura': 0, 'ms-palya': 0, 'yelahanka': 20, 'cafe': 0 },
        consumed: { 'brigade': 0, 'vidyaranyapura': 0, 'ms-palya': 0, 'yelahanka': 6, 'cafe': 0 }
    },
    {
        id: 'item_07',
        name: 'Fresh Chicken',
        category: 'Meat',
        cuisine: 'Tandoor',
        vendor: 'Maruthi',
        unit: 'kg',
        bought: 80,
        allocations: { 'brigade': 15, 'vidyaranyapura': 20, 'ms-palya': 10, 'yelahanka': 5, 'cafe': 0 },
        consumed: { 'brigade': 5, 'vidyaranyapura': 8, 'ms-palya': 3, 'yelahanka': 2, 'cafe': 0 }
    },
    {
        id: 'item_08',
        name: 'Tomatoes',
        category: 'Vegetables',
        cuisine: 'Kerala',
        vendor: 'Prestige',
        unit: 'kg',
        bought: 60,
        allocations: { 'brigade': 2, 'vidyaranyapura': 10, 'ms-palya': 15, 'yelahanka': 8, 'cafe': 2 },
        consumed: { 'brigade': 1, 'vidyaranyapura': 4, 'ms-palya': 5, 'yelahanka': 3, 'cafe': 1 }
    },
    {
        id: 'item_09',
        name: 'Coffee beans',
        category: 'Grocery',
        cuisine: 'Arabic',
        vendor: 'HVC',
        unit: 'kg',
        bought: 25,
        allocations: { 'brigade': 5, 'vidyaranyapura': 0, 'ms-palya': 0, 'yelahanka': 15, 'cafe': 0 },
        consumed: { 'brigade': 2, 'vidyaranyapura': 0, 'ms-palya': 0, 'yelahanka': 5, 'cafe': 0 }
    },
    {
        id: 'item_10',
        name: 'sample',
        category: 'Dry',
        cuisine: 'Indian',
        vendor: 'Prestige',
        unit: 'kg',
        bought: 200,
        allocations: { 'brigade': 0, 'vidyaranyapura': 0, 'ms-palya': 0, 'yelahanka': 0, 'cafe': 0 },
        consumed: { 'brigade': 0, 'vidyaranyapura': 0, 'ms-palya': 0, 'yelahanka': 0, 'cafe': 0 }
    }
];

const defaultRequests = [
    {
        id: 'req_01',
        itemId: 'item_07',
        itemName: 'Fresh Chicken',
        unit: 'kg',
        outletId: 'brigade',
        outletName: 'BRIGADE',
        qty: 8,
        cuisine: 'Tandoor',
        chefName: 'Chef Prince',
        requestedBy: 'Chef Prince',
        status: 'Pending',
        timestamp: new Date().toISOString()
    },
    {
        id: 'req_02',
        itemId: 'item_07',
        itemName: 'Fresh Chicken',
        unit: 'kg',
        outletId: 'brigade',
        outletName: 'BRIGADE',
        qty: 5,
        cuisine: 'Chinese',
        chefName: 'Chef Li',
        requestedBy: 'Chef Li',
        status: 'Pending',
        timestamp: new Date().toISOString()
    },
    {
        id: 'req_03',
        itemId: 'item_08',
        itemName: 'Tomatoes',
        unit: 'kg',
        outletId: 'brigade',
        outletName: 'BRIGADE',
        qty: 12,
        cuisine: 'Kerala',
        chefName: 'Chef Sasi',
        requestedBy: 'Chef Sasi',
        status: 'Pending',
        timestamp: new Date().toISOString()
    },
    {
        id: 'req_04',
        itemId: 'item_01',
        itemName: 'Tuna',
        unit: 'pcs',
        outletId: 'brigade',
        outletName: 'BRIGADE',
        qty: 10,
        cuisine: 'Continental',
        chefName: 'Chef Prince',
        requestedBy: 'Chef Prince',
        status: 'Pending',
        timestamp: new Date().toISOString()
    }
];

let masterItemsData = JSON.parse(localStorage.getItem('nchef_items')) || [];
// Auto-seed if items is empty or missing the live Tuna item
if (masterItemsData.length === 0 || !masterItemsData.some(i => i.name === 'Tuna')) {
    masterItemsData.length = 0;
    masterItemsData.push(...defaultMasterItems);
    localStorage.setItem('nchef_items', JSON.stringify(masterItemsData));
}

const requestsData = JSON.parse(localStorage.getItem('nchef_requests')) || [];
if (requestsData.length === 0) {
    requestsData.push(...defaultRequests);
    localStorage.setItem('nchef_requests', JSON.stringify(requestsData));
}

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
    } else if (usersData.length === 0) {
        usersData.push(...defaultUsers);
    }
    const rawVendors = localStorage.getItem('nchef_vendors');
    if (rawVendors) {
        vendorsData.length = 0;
        vendorsData.push(...JSON.parse(rawVendors));
    } else if (vendorsData.length === 0) {
        vendorsData.push(...defaultVendors);
    }
    const rawOutlets = localStorage.getItem('nchef_outlets');
    if (rawOutlets) {
        outletsData.length = 0;
        outletsData.push(...JSON.parse(rawOutlets));
    } else if (outletsData.length === 0) {
        outletsData.push(...defaultOutlets);
    }
    const rawItems = localStorage.getItem('nchef_items');
    if (rawItems) {
        masterItemsData.length = 0;
        masterItemsData.push(...JSON.parse(rawItems));
    }
    if (masterItemsData.length === 0) {
        masterItemsData.push(...defaultMasterItems);
        localStorage.setItem('nchef_items', JSON.stringify(masterItemsData));
    }
    const rawRequests = localStorage.getItem('nchef_requests');
    if (rawRequests) {
        requestsData.length = 0;
        requestsData.push(...JSON.parse(rawRequests));
    }
    if (requestsData.length === 0) {
        requestsData.push(...defaultRequests);
        localStorage.setItem('nchef_requests', JSON.stringify(requestsData));
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

window.resetToDemoData = function() {
    usersData.length = 0;
    usersData.push(...defaultUsers);
    vendorsData.length = 0;
    vendorsData.push(...defaultVendors);
    outletsData.length = 0;
    outletsData.push(...defaultOutlets);
    masterItemsData.length = 0;
    masterItemsData.push(...defaultMasterItems);
    requestsData.length = 0;
    requestsData.push(...defaultRequests);
    indentsData.length = 0;
    purchaseOrdersData.length = 0;
    saveData();
    if (typeof reloadDataFromStorage === 'function') reloadDataFromStorage();
    if (typeof window.onLiveSyncReceived === 'function') window.onLiveSyncReceived();
    if (typeof window.showToast === 'function') {
        window.showToast("Demo data successfully restored!", "success");
    }
};

// First time auto-seed save if items or requests were empty
if (localStorage.getItem('nchef_items') === null || localStorage.getItem('nchef_requests') === null) {
    saveData();
}


