ALTER TABLE shipments
  ADD COLUMN estimated_delivery DATE NULL AFTER status;
