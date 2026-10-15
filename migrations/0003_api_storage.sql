-- Payloads preserve existing screen fields alongside relational references.
ALTER TABLE users ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(profile_json));
ALTER TABLE outlets ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json));
ALTER TABLE vendors ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json));
ALTER TABLE items ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json));
ALTER TABLE requests ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json));
ALTER TABLE requests ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1));
ALTER TABLE indents ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json));
ALTER TABLE indents ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1));
ALTER TABLE purchase_orders ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json));
ALTER TABLE purchase_orders ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1));
UPDATE outlets SET payload_json = json_object('id', id, 'name', name);
UPDATE vendors SET payload_json = json_object('id', id, 'name', name);
UPDATE items SET payload_json = json_object('id', id, 'name', name, 'category', category,
  'unit', unit, 'vendor', (SELECT name FROM vendors WHERE vendors.id = items.vendor_id),
  'bought', 0, 'allocations', json('{}'), 'consumed', json('{}'));
CREATE TABLE app_revision (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL);
INSERT INTO app_revision VALUES (1, 0);
CREATE TABLE command_receipts (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  expected_revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE setup_lock (id INTEGER PRIMARY KEY CHECK (id = 1));
