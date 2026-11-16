-- PDP accordions "Benefits" and "Ingredients", written in the admin product form (plain text, **bold** allowed).
ALTER TABLE products
  ADD COLUMN benefits_text TEXT NULL AFTER benefits,
  ADD COLUMN ingredients TEXT NULL AFTER benefits_text;
