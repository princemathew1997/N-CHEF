-- Preserve historical records. Only an audited command establishes a shared dispatch.
UPDATE operation_records SET payload_json=json_set(payload_json,'$.dispatchId',
 'earlier_'||(SELECT json_extract(a.details_json,'$.operationId') FROM audit_events a
 WHERE a.entity_type='delivery' AND a.entity_id=operation_records.id AND a.action='create'
 AND json_extract(a.details_json,'$.operationId') IS NOT NULL ORDER BY a.rowid LIMIT 1)
 ||'_'||json_extract(payload_json,'$.cuisine')||'_'||coalesce(json_extract(payload_json,'$.recipientId'),''),
 '$.earlierDelivery',json('true'))
 WHERE kind='delivery' AND json_extract(payload_json,'$.dispatchId') IS NULL
 AND EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_type='delivery' AND a.entity_id=operation_records.id
 AND a.action='create' AND json_extract(a.details_json,'$.operationId') IS NOT NULL);

UPDATE operation_records SET payload_json=json_set(payload_json,'$.indentId',
 (SELECT indent_id FROM requests WHERE requests.id=json_extract(operation_records.payload_json,'$.requestId')),
 '$.orderRef',coalesce((SELECT indent_number FROM indents WHERE indents.id=(SELECT indent_id FROM requests WHERE requests.id=json_extract(operation_records.payload_json,'$.requestId'))),json_extract(payload_json,'$.requestId')))
 WHERE kind='delivery' AND json_extract(payload_json,'$.orderRef') IS NULL;

ALTER TABLE operation_records ADD COLUMN delivery_dispatch TEXT GENERATED ALWAYS AS
 (CASE WHEN kind='delivery' THEN coalesce(json_extract(payload_json,'$.dispatchId'),id) END) VIRTUAL;
ALTER TABLE operation_records ADD COLUMN delivery_outlet TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.outletId')) VIRTUAL;
ALTER TABLE operation_records ADD COLUMN delivery_cuisine TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.cuisine')) VIRTUAL;
ALTER TABLE operation_records ADD COLUMN delivery_recipient TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.recipientId')) VIRTUAL;
ALTER TABLE operation_records ADD COLUMN delivery_status TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.status')) VIRTUAL;
ALTER TABLE operation_records ADD COLUMN delivery_created TEXT GENERATED ALWAYS AS (json_extract(payload_json,'$.createdAt')) VIRTUAL;
CREATE INDEX delivery_dispatch_rows ON operation_records(kind,delivery_dispatch,delivery_created,id);
CREATE INDEX delivery_queue_scope ON operation_records(kind,delivery_outlet,delivery_cuisine,delivery_status,delivery_created,id);
CREATE INDEX delivery_recipient_queue ON operation_records(kind,delivery_recipient,delivery_status,delivery_created,id);
CREATE INDEX delivery_request_totals ON operation_records(kind,json_extract(payload_json,'$.requestId'));
CREATE INDEX stock_history_page ON outlet_stock_history(outlet_id,created_at DESC,id DESC);
CREATE INDEX stock_history_item_page ON outlet_stock_history(outlet_id,item_id,created_at DESC,id DESC);
CREATE INDEX stock_history_time_page ON outlet_stock_history(created_at DESC,id DESC);
CREATE INDEX stock_history_kind_page ON outlet_stock_history(outlet_id,kind,created_at DESC,id DESC);
CREATE INDEX stock_history_vendor_page ON outlet_stock_history(outlet_id,vendor,created_at DESC,id DESC);
CREATE INDEX stock_history_person_page ON outlet_stock_history(outlet_id,actor_id,created_at DESC,id DESC);
CREATE INDEX notification_user_read ON operation_records(kind,json_extract(payload_json,'$.userId'),json_extract(payload_json,'$.read'));
