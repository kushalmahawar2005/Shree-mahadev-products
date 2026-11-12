-- GST invoice v2: explicit invoice date, buyer GSTIN for business orders.
ALTER TABLE invoices
  ADD COLUMN invoice_date DATE NULL AFTER seq;
UPDATE invoices SET invoice_date = DATE(created_at) WHERE invoice_date IS NULL;
ALTER TABLE invoices MODIFY invoice_date DATE NOT NULL;

ALTER TABLE orders
  ADD COLUMN customer_gstin VARCHAR(15) NULL AFTER email;
