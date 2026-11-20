-- Almond oil is made in the same wooden Kolhu as every other oil (owner, 20 Nov 2026): rename
-- "Cold-Pressed Almond Oil" to "Wood-Pressed Almond Oil" in the product, its SEO text and photo alt text.
-- Past orders keep the title they were placed with (order_items is not touched). URL stays /products/almond-oil.
UPDATE products SET
  title = REPLACE(title, 'Cold-Pressed', 'Wood-Pressed'),
  seo_title = REPLACE(seo_title, 'Cold-Pressed', 'Wood-Pressed'),
  seo_description = REPLACE(REPLACE(seo_description, 'Cold-Pressed', 'Wood-Pressed'), 'cold-pressed', 'wood-pressed'),
  short_description = REPLACE(REPLACE(short_description, 'Cold-Pressed', 'Wood-Pressed'), 'cold-pressed', 'wood-pressed'),
  description_html = REPLACE(description_html, 'Cold-Pressed', 'Wood-Pressed')
WHERE handle = 'almond-oil';
UPDATE product_images SET alt = REPLACE(alt, 'Cold-Pressed', 'Wood-Pressed') WHERE product_handle = 'almond-oil';
