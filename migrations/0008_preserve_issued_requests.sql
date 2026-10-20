-- The former approval action already issued stock. Fence historical approvals
-- from being issued again by the new, separate distribution action.
UPDATE requests SET payload_json=json_set(payload_json,'$.legacyIssuedQuantity',coalesce(json_extract(payload_json,'$.revisedQty'),quantity)) WHERE status='Approved';
