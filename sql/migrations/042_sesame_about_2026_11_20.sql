-- PDP "About" text, client round of 20 Nov 2026: brown til = Marwari seed, black til = sourced from Gujarat.
-- Previous text is in backup_20261120_products (taken by migration 040).
UPDATE products SET description_html = '<p>Pressed from desi brown sesame, the Marwari seed grown by farmers in Marwar, Rajasthan. Warm, toasty til aroma for daily cooking, pickles and winter malish.</p>' WHERE handle = 'brown-sesame-oil';
UPDATE products SET description_html = '<p>Pressed from jet-black til sourced from Gujarat. Deep in colour and aroma. Traditionally used for oil pulling, abhyanga and hair care.</p>' WHERE handle = 'black-sesame-oil';
