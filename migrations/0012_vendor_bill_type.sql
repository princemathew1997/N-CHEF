ALTER TABLE outlet_stock_history ADD COLUMN vendor_bill_type TEXT CHECK (vendor_bill_type IN ('cash', 'credit'));
