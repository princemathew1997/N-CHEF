-- Fresh relational storage; authentication credentials are never seeded from the demo.
CREATE TABLE outlets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE TABLE cuisines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  vendor_id TEXT REFERENCES vendors(id),
  unit TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE INDEX items_vendor_idx ON items(vendor_id);
-- Central inventory uses location_id 'central'; outlet rows use their outlet ID.
CREATE TABLE stock_locations (
  id TEXT PRIMARY KEY,
  outlet_id TEXT UNIQUE REFERENCES outlets(id),
  CHECK ((id = 'central' AND outlet_id IS NULL) OR (id <> 'central' AND outlet_id IS NOT NULL AND outlet_id = id))
);
CREATE TABLE inventory_balances (
  item_id TEXT NOT NULL REFERENCES items(id),
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  PRIMARY KEY (item_id, location_id)
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'chef')),
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE user_outlets (
  user_id TEXT NOT NULL REFERENCES users(id),
  outlet_id TEXT NOT NULL REFERENCES outlets(id),
  PRIMARY KEY (user_id, outlet_id)
);
CREATE TABLE user_cuisines (
  user_id TEXT NOT NULL REFERENCES users(id),
  cuisine_id TEXT NOT NULL REFERENCES cuisines(id),
  PRIMARY KEY (user_id, cuisine_id)
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE indents (
  id TEXT PRIMARY KEY,
  indent_number TEXT NOT NULL UNIQUE,
  outlet_id TEXT NOT NULL REFERENCES outlets(id),
  supervisor_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Pending Approval',
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX indents_outlet_status_idx ON indents(outlet_id, status);
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  outlet_id TEXT NOT NULL REFERENCES outlets(id),
  cuisine_id TEXT NOT NULL REFERENCES cuisines(id),
  chef_id TEXT NOT NULL REFERENCES users(id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  revised_quantity REAL CHECK (revised_quantity >= 0),
  supervisor_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  indent_id TEXT REFERENCES indents(id),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX requests_outlet_status_idx ON requests(outlet_id, status);
CREATE INDEX requests_chef_idx ON requests(chef_id);
CREATE INDEX requests_indent_idx ON requests(indent_id);
CREATE TABLE indent_items (
  indent_id TEXT NOT NULL REFERENCES indents(id),
  item_id TEXT NOT NULL REFERENCES items(id),
  original_quantity REAL NOT NULL CHECK (original_quantity >= 0),
  revised_quantity REAL NOT NULL CHECK (revised_quantity >= 0),
  comment TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (indent_id, item_id)
);
CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  indent_id TEXT REFERENCES indents(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE purchase_order_items (
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  item_id TEXT NOT NULL REFERENCES items(id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  received_quantity REAL NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= quantity),
  PRIMARY KEY (purchase_order_id, item_id)
);
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  -- Unique command ID prevents the same receipt/approval being applied twice.
  operation_id TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id),
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  delta REAL NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (operation_id, item_id, location_id)
);
CREATE INDEX stock_movements_location_idx ON stock_movements(location_id, created_at);
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
