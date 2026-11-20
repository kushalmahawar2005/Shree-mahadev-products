-- Black Sesame Oil photos (uploaded to Cloudinary on 16 Nov, only in the local DB so far): live shows an
-- empty placeholder bottle. Inserts them only when the product has no photos yet, so admin uploads win.
INSERT INTO product_images (product_handle, public_id, url, alt, width, height, sort_order)
SELECT v.product_handle, v.public_id, v.url, v.alt, 1600, 2000, v.sort_order
FROM (
  SELECT 'black-sesame-oil' AS product_handle, 'swadeshi-mahadev/products/black-sesame-oil/1l-front' AS public_id,
         'https://res.cloudinary.com/bmqxsylj/image/upload/v1794811935/swadeshi-mahadev/products/black-sesame-oil/1l-front.jpg' AS url,
         'Wood-Pressed Black Sesame Oil 1 L bottle, front label' AS alt, 0 AS sort_order
  UNION ALL SELECT 'black-sesame-oil', 'swadeshi-mahadev/products/black-sesame-oil/1l-back',
         'https://res.cloudinary.com/bmqxsylj/image/upload/v1794811935/swadeshi-mahadev/products/black-sesame-oil/1l-back.jpg',
         'Wood-Pressed Black Sesame Oil 1 L bottle, back label', 1
  UNION ALL SELECT 'black-sesame-oil', 'swadeshi-mahadev/products/black-sesame-oil/500ml-front',
         'https://res.cloudinary.com/bmqxsylj/image/upload/v1794811936/swadeshi-mahadev/products/black-sesame-oil/500ml-front.jpg',
         'Wood-Pressed Black Sesame Oil 500 ml bottle, front label', 2
  UNION ALL SELECT 'black-sesame-oil', 'swadeshi-mahadev/products/black-sesame-oil/250ml-front',
         'https://res.cloudinary.com/bmqxsylj/image/upload/v1794811935/swadeshi-mahadev/products/black-sesame-oil/250ml-front.jpg',
         'Wood-Pressed Black Sesame Oil 250 ml bottle, front label', 3
  UNION ALL SELECT 'black-sesame-oil', 'swadeshi-mahadev/products/black-sesame-oil/100ml-front',
         'https://res.cloudinary.com/bmqxsylj/image/upload/v1794811937/swadeshi-mahadev/products/black-sesame-oil/100ml-front.jpg',
         'Wood-Pressed Black Sesame Oil 100 ml bottle, front label', 4
) AS v
WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_handle = 'black-sesame-oil');
