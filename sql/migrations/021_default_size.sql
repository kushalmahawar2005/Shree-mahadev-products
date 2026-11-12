-- Size a product opens on in cards and on its page (e.g. "1 L", "250 ml"), matched by variant title.
-- NULL = storefront picks one itself (cheapest on cards, 1 L / 1 kg on the product page).
ALTER TABLE products ADD COLUMN default_size VARCHAR(40) NULL AFTER status;
