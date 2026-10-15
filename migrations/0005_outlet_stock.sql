CREATE TABLE outlet_stock (item_id TEXT NOT NULL REFERENCES items(id), outlet_id TEXT NOT NULL REFERENCES outlets(id), quantity REAL NOT NULL CHECK(quantity >= 0), PRIMARY KEY(item_id,outlet_id));
CREATE TABLE legacy_stock (item_id TEXT PRIMARY KEY REFERENCES items(id), quantity REAL NOT NULL, issue TEXT NOT NULL DEFAULT '');
CREATE TABLE outlet_stock_history (id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES items(id), outlet_id TEXT REFERENCES outlets(id), delta REAL NOT NULL, quantity REAL NOT NULL, kind TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', cuisine TEXT NOT NULL DEFAULT '', vendor TEXT NOT NULL DEFAULT '', item_name TEXT NOT NULL, unit TEXT NOT NULL, actor_id TEXT REFERENCES users(id), actor_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX outlet_stock_history_outlet ON outlet_stock_history(outlet_id,created_at);
INSERT INTO outlet_stock SELECT i.id, o.id, max(0,coalesce(json_extract(i.payload_json,'$.allocations.'||o.id),0)-coalesce(json_extract(i.payload_json,'$.consumed.'||o.id),0)) FROM items i CROSS JOIN outlets o;
INSERT INTO legacy_stock SELECT i.id, coalesce(json_extract(i.payload_json,'$.bought'),0)-coalesce((SELECT sum(value) FROM json_each(i.payload_json,'$.allocations')),0), CASE WHEN coalesce(json_extract(i.payload_json,'$.bought'),0)<coalesce((SELECT sum(value) FROM json_each(i.payload_json,'$.allocations')),0) OR EXISTS(SELECT 1 FROM json_each(i.payload_json,'$.consumed') c WHERE c.value>coalesce(json_extract(i.payload_json,'$.allocations.'||c.key),0)) OR EXISTS(SELECT 1 FROM json_each(i.payload_json,'$.allocations') a WHERE a.key NOT IN (SELECT id FROM outlets) OR a.value<0) OR EXISTS(SELECT 1 FROM json_each(i.payload_json,'$.consumed') c WHERE c.key NOT IN (SELECT id FROM outlets) OR c.value<0) OR coalesce(json_extract(i.payload_json,'$.bought'),0)<0 THEN 'Legacy quantities inconsistent; admin reconciliation required' ELSE '' END FROM items i;
INSERT INTO outlet_stock_history(id,operation_id,item_id,outlet_id,delta,quantity,kind,item_name,unit,actor_name) SELECT 'opening_'||s.item_id||'_'||s.outlet_id,'migration_0005',s.item_id,s.outlet_id,s.quantity,s.quantity,'opening',i.name,i.unit,'Migration' FROM outlet_stock s JOIN items i ON i.id=s.item_id WHERE s.quantity>0;
CREATE TRIGGER outlet_history_no_update BEFORE UPDATE ON outlet_stock_history BEGIN SELECT RAISE(ABORT,'History is append only'); END;
CREATE TRIGGER outlet_history_no_delete BEFORE DELETE ON outlet_stock_history BEGIN SELECT RAISE(ABORT,'History is append only'); END;
-- Fence old application versions from updating the retired stock representation.
CREATE TRIGGER legacy_item_stock_read_only BEFORE UPDATE OF payload_json ON items
WHEN json_extract(NEW.payload_json,'$.bought') IS NOT json_extract(OLD.payload_json,'$.bought')
  OR json_extract(NEW.payload_json,'$.allocations') IS NOT json_extract(OLD.payload_json,'$.allocations')
  OR json_extract(NEW.payload_json,'$.consumed') IS NOT json_extract(OLD.payload_json,'$.consumed')
BEGIN SELECT RAISE(ABORT,'LEGACY_STOCK_READ_ONLY: upgrade the inventory API'); END;
CREATE TRIGGER new_item_stock_empty BEFORE INSERT ON items
WHEN NOT EXISTS(SELECT 1 FROM items WHERE id=NEW.id) AND (coalesce(json_extract(NEW.payload_json,'$.bought'),0) <> 0
  OR EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.allocations'))
  OR EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.consumed')))
BEGIN SELECT RAISE(ABORT,'LEGACY_STOCK_READ_ONLY: use outlet stock transactions'); END;
