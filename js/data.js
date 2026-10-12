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
        username: 'supervisor',
        password: '123',
        role: 'supervisor',
        name: 'Supervisor',
        title: 'Supervisor',
        salary: '-',
        assignedLocations: [primaryOutlet.id]
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
        addedBySupervisor: 'Supervisor'
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
        addedBySupervisor: 'Supervisor'
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
        addedBySupervisor: 'Supervisor'
    },
    {
        username: 'chef_rahul',
        password: '123',
        role: 'chef',
        name: 'Chef Rahul',
        title: 'Section Chef',
        salary: '-',
        assignedLocations: ['brigade'],
        assignedSections: ['Indian'],
        assignedCuisines: ['Indian'],
        addedBySupervisor: 'Supervisor'
    }
];

const usersData = JSON.parse(localStorage.getItem('nchef_users')) || [];
if (usersData.length === 0) {
    usersData.push(...defaultUsers);
}

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

const defaultMasterItems = [
    {
        id: 'item_01',
        name: 'Fresh Chicken (Curry Cut)',
        category: 'Meat',
        vendor: 'Prime Meats & Seafood',
        unit: 'kg',
        bought: 120,
        allocations: { 'brigade': 35, 'vidyaranyapura': 25, 'yelahanka': 20, 'ms-palya': 20 },
        consumed: { 'brigade': 15, 'vidyaranyapura': 10, 'yelahanka': 8, 'ms-palya': 5 }
    },
    {
        id: 'item_02',
        name: 'Fresh Farm Tomatoes',
        category: 'Vegetables',
        vendor: 'Fresh Farms Produce Ltd',
        unit: 'kg',
        bought: 90,
        allocations: { 'brigade': 25, 'vidyaranyapura': 20, 'yelahanka': 18, 'ms-palya': 15 },
        consumed: { 'brigade': 10, 'vidyaranyapura': 8, 'yelahanka': 5, 'ms-palya': 4 }
    },
    {
        id: 'item_03',
        name: 'Royal Basmati Rice',
        category: 'Grains',
        vendor: 'Metro Food Distributors',
        unit: 'kg',
        bought: 200,
        allocations: { 'brigade': 60, 'vidyaranyapura': 45, 'yelahanka': 40, 'ms-palya': 35 },
        consumed: { 'brigade': 25, 'vidyaranyapura': 15, 'yelahanka': 10, 'ms-palya': 10 }
    },
    {
        id: 'item_04',
        name: 'Red Onions',
        category: 'Vegetables',
        vendor: 'Fresh Farms Produce Ltd',
        unit: 'kg',
        bought: 100,
        allocations: { 'brigade': 30, 'vidyaranyapura': 25, 'yelahanka': 20, 'ms-palya': 15 },
        consumed: { 'brigade': 12, 'vidyaranyapura': 10, 'yelahanka': 8, 'ms-palya': 5 }
    },
    {
        id: 'item_05',
        name: 'Pure Dairy Paneer',
        category: 'Dairy',
        vendor: 'Global Dairy Supplies',
        unit: 'kg',
        bought: 45,
        allocations: { 'brigade': 15, 'vidyaranyapura': 12, 'yelahanka': 8, 'ms-palya': 6 },
        consumed: { 'brigade': 8, 'vidyaranyapura': 5, 'yelahanka': 4, 'ms-palya': 2 }
    },
    {
        id: 'item_06',
        name: 'Refined Sunflower Oil',
        category: 'Dairy',
        vendor: 'Global Dairy Supplies',
        unit: 'L',
        bought: 80,
        allocations: { 'brigade': 25, 'vidyaranyapura': 20, 'yelahanka': 15, 'ms-palya': 12 },
        consumed: { 'brigade': 10, 'vidyaranyapura': 8, 'yelahanka': 6, 'ms-palya': 4 }
    },
    {
        id: 'item_07',
        name: 'Ginger Garlic Paste',
        category: 'Spices',
        vendor: 'Metro Food Distributors',
        unit: 'kg',
        bought: 30,
        allocations: { 'brigade': 10, 'vidyaranyapura': 8, 'yelahanka': 6, 'ms-palya': 4 },
        consumed: { 'brigade': 4, 'vidyaranyapura': 3, 'yelahanka': 2, 'ms-palya': 2 }
    },
    {
        id: 'item_08',
        name: 'Mutton Curry Cut',
        category: 'Meat',
        vendor: 'Prime Meats & Seafood',
        unit: 'kg',
        bought: 50,
        allocations: { 'brigade': 18, 'vidyaranyapura': 12, 'yelahanka': 10, 'ms-palya': 8 },
        consumed: { 'brigade': 8, 'vidyaranyapura': 5, 'yelahanka': 4, 'ms-palya': 2 }
    }
];

const defaultRequests = [
    {
        id: 'req_01',
        itemId: 'item_01',
        itemName: 'Fresh Chicken (Curry Cut)',
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
        itemId: 'item_01',
        itemName: 'Fresh Chicken (Curry Cut)',
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
        itemId: 'item_02',
        itemName: 'Fresh Farm Tomatoes',
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
        itemId: 'item_03',
        itemName: 'Royal Basmati Rice',
        unit: 'kg',
        outletId: 'brigade',
        outletName: 'BRIGADE',
        qty: 20,
        cuisine: 'Indian',
        chefName: 'Chef Rahul',
        requestedBy: 'Chef Rahul',
        status: 'Pending',
        timestamp: new Date().toISOString()
    },
    {
        id: 'req_05',
        itemId: 'item_05',
        itemName: 'Pure Dairy Paneer',
        unit: 'kg',
        outletId: 'brigade',
        outletName: 'BRIGADE',
        qty: 6,
        cuisine: 'North Indian',
        chefName: 'Chef Amit',
        requestedBy: 'Chef Amit',
        status: 'Accepted',
        timestamp: new Date().toISOString()
    }
];

let masterItemsData = JSON.parse(localStorage.getItem('nchef_items')) || [];
if (masterItemsData.length === 0) {
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


