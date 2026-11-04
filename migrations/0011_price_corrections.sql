-- Preserve movement facts while permitting audited corrections to entered costs.
DROP TRIGGER outlet_history_no_update;
CREATE TRIGGER outlet_history_no_update BEFORE UPDATE ON outlet_stock_history
WHEN NEW.rowid IS NOT OLD.rowid OR NEW.id IS NOT OLD.id
  OR NEW.operation_id IS NOT OLD.operation_id OR NEW.item_id IS NOT OLD.item_id
  OR NEW.outlet_id IS NOT OLD.outlet_id OR NEW.delta IS NOT OLD.delta
  OR NEW.quantity IS NOT OLD.quantity OR NEW.kind IS NOT OLD.kind
  OR NEW.reason IS NOT OLD.reason OR NEW.cuisine IS NOT OLD.cuisine
  OR NEW.vendor IS NOT OLD.vendor OR NEW.item_name IS NOT OLD.item_name
  OR NEW.unit IS NOT OLD.unit OR NEW.actor_id IS NOT OLD.actor_id
  OR NEW.actor_name IS NOT OLD.actor_name OR NEW.created_at IS NOT OLD.created_at
  OR NEW.delivery_id IS NOT OLD.delivery_id
BEGIN SELECT RAISE(ABORT,'History is append only'); END;

CREATE INDEX audit_stock_price_corrections ON audit_events(entity_id,action);
CREATE TRIGGER outlet_history_price_audit BEFORE UPDATE OF unit_cost_minor,total_cost_minor ON outlet_stock_history
WHEN OLD.kind NOT IN ('receipt','opening') OR OLD.delta<=0
  OR typeof(NEW.unit_cost_minor)!='integer' OR NEW.unit_cost_minor<0
  OR typeof(NEW.total_cost_minor)!='integer' OR NEW.total_cost_minor!=round(OLD.delta*NEW.unit_cost_minor)
  OR NOT EXISTS (
    SELECT 1 FROM audit_events a JOIN revision_guards g ON g.command_id=json_extract(a.details_json,'$.operationId')
    JOIN command_receipts c ON c.id=g.command_id AND c.actor_id=a.actor_id
    WHERE a.entity_id=OLD.id AND a.entity_type='stock' AND a.action='price_correction'
      AND json_extract(a.details_json,'$.previousUnitCostMinor') IS OLD.unit_cost_minor
      AND json_extract(a.details_json,'$.previousTotalCostMinor') IS OLD.total_cost_minor
      AND json_extract(a.details_json,'$.unitCostMinor') IS NEW.unit_cost_minor
      AND json_extract(a.details_json,'$.totalCostMinor') IS NEW.total_cost_minor
  )
BEGIN SELECT RAISE(ABORT,'Price correction requires an audited command'); END;
