-- Bulk inquiries can now list several products (checkboxes), joined with commas.
ALTER TABLE inquiries MODIFY product VARCHAR(600) NULL;
