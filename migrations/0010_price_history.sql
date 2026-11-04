CREATE INDEX outlet_receipt_price_history ON outlet_stock_history(item_id,created_at DESC,id DESC) WHERE kind='receipt' AND delta>0 AND unit_cost_minor IS NOT NULL;
