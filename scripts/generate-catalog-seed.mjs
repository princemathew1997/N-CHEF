import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Evaluate the existing trusted demo data with isolated, in-memory browser stubs.
// Export ONLY catalog constants, never passwords or demonstration transactions.
const values = new Map();
const context = {
  localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  window: {},
};
const source = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const catalog = runInNewContext(`${source}\n({outlets: defaultOutlets, vendors: defaultVendors, items: defaultMasterItems, cuisines: cuisinesData})`, context, { timeout: 1000 });
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const lines = ['-- Fresh catalog only. Opening stock, users, and transactions remain empty.'];
for (const outlet of catalog.outlets) lines.push(`INSERT INTO outlets (id, name) VALUES (${quote(outlet.id)}, ${quote(outlet.name)});`);
for (const vendor of catalog.vendors) lines.push(`INSERT INTO vendors (id, name) VALUES (${quote(vendor.id)}, ${quote(vendor.name)});`);
for (const cuisine of catalog.cuisines) lines.push(`INSERT INTO cuisines (id, name) VALUES (${quote(cuisine.id)}, ${quote(cuisine.name)});`);
for (const item of catalog.items) {
  const vendor = catalog.vendors.find(v => v.name === item.vendor);
  if (!vendor) throw new Error(`Unknown vendor for ${item.id}`);
  lines.push(`INSERT INTO items (id, name, category, vendor_id, unit) VALUES (${[item.id, item.name, item.category, vendor.id, item.unit].map(quote).join(', ')});`);
}
lines.push("INSERT INTO stock_locations (id, outlet_id) VALUES ('central', NULL);");
lines.push('INSERT INTO stock_locations (id, outlet_id) SELECT id, id FROM outlets;');
lines.push('INSERT INTO inventory_balances (item_id, location_id) SELECT items.id, stock_locations.id FROM items CROSS JOIN stock_locations;');
writeFileSync(new URL('../migrations/0002_fresh_catalog.sql', import.meta.url), lines.join('\n') + '\n');
console.log(`Catalog: ${catalog.outlets.length} outlets, ${catalog.vendors.length} vendors, ${catalog.cuisines.length} cuisines, ${catalog.items.length} items; stock starts at zero.`);
