-- Preserve the referenced users table and legacy role column during conversion.
ALTER TABLE users ADD COLUMN effective_role TEXT CHECK(effective_role IN ('admin','executive_chef','purchaser','cuisine_head'));
UPDATE users SET effective_role=CASE role WHEN 'supervisor' THEN 'executive_chef' WHEN 'chef' THEN 'cuisine_head' ELSE 'admin' END;
UPDATE users SET profile_json=json_set(profile_json,'$.role',effective_role,'$.title',CASE effective_role WHEN 'executive_chef' THEN 'Executive Chef' WHEN 'cuisine_head' THEN 'Cuisine Head' ELSE 'Administrator' END);
ALTER TABLE outlet_stock ADD COLUMN unit_cost_minor INTEGER CHECK(unit_cost_minor >= 0);
ALTER TABLE outlet_stock_history ADD COLUMN unit_cost_minor INTEGER CHECK(unit_cost_minor >= 0);
ALTER TABLE outlet_stock_history ADD COLUMN total_cost_minor INTEGER CHECK(total_cost_minor >= 0);
ALTER TABLE outlet_stock_history ADD COLUMN delivery_id TEXT;
CREATE TABLE operation_records (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('category','unit','delivery','wastage','account_request','notification','reconciliation')),
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE INDEX operation_records_kind ON operation_records(kind);
INSERT INTO operation_records SELECT 'category_'||min(id),'category',json_object('id','category_'||min(id),'name',trim(category)) FROM items GROUP BY lower(trim(category));
INSERT INTO operation_records SELECT 'unit_'||min(id),'unit',json_object('id','unit_'||min(id),'name',trim(unit)) FROM items GROUP BY lower(trim(unit));
UPDATE items SET category=trim(category),unit=trim(unit),payload_json=json_set(payload_json,'$.category',trim(category),'$.unit',trim(unit),'$.thresholdEnabled',json('false'),'$.threshold',0);
UPDATE app_revision SET revision=revision+1 WHERE id=1;
