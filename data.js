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

const vendorsData = JSON.parse(localStorage.getItem('nchef_vendors')) || [];
let masterItemsData = JSON.parse(localStorage.getItem('nchef_items')) || [];
const requestsData = JSON.parse(localStorage.getItem('nchef_requests')) || [];
const indentsData = JSON.parse(localStorage.getItem('nchef_indents')) || [];

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

function saveData() {
    localStorage.setItem('nchef_users', JSON.stringify(usersData));
    localStorage.setItem('nchef_vendors', JSON.stringify(vendorsData));
    localStorage.setItem('nchef_outlets', JSON.stringify(outletsData));
    localStorage.setItem('nchef_items', JSON.stringify(masterItemsData));
    localStorage.setItem('nchef_requests', JSON.stringify(requestsData));
    localStorage.setItem('nchef_indents', JSON.stringify(indentsData));
}

function initSeedRequests() {
    if (requestsData.length === 0 && masterItemsData.length > 0) {
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


