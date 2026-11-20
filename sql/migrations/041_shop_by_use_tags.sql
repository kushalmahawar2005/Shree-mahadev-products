-- Shop-by-use lists, client round of 20 Nov 2026 ("Problem" group):
--   Hair & skin: add flaxseed, remove brown sesame.
--   Baby massage: add yellow mustard, remove black mustard.
--   New use "joint-massage" (joint / heel pain, body malish): black mustard, castor, walnut.
-- Order inside each list is set in code (src/data/home.ts). Each statement is safe to run twice.
UPDATE products SET tags = JSON_ARRAY_APPEND(COALESCE(tags, JSON_ARRAY()), '$', 'hair-skin')
  WHERE handle = 'flaxseed-oil' AND NOT JSON_CONTAINS(COALESCE(tags, JSON_ARRAY()), '"hair-skin"');
UPDATE products SET tags = JSON_REMOVE(tags, JSON_UNQUOTE(JSON_SEARCH(tags, 'one', 'hair-skin')))
  WHERE handle = 'brown-sesame-oil' AND JSON_CONTAINS(tags, '"hair-skin"');
UPDATE products SET tags = JSON_ARRAY_APPEND(COALESCE(tags, JSON_ARRAY()), '$', 'baby-massage')
  WHERE handle = 'yellow-mustard-oil' AND NOT JSON_CONTAINS(COALESCE(tags, JSON_ARRAY()), '"baby-massage"');
UPDATE products SET tags = JSON_REMOVE(tags, JSON_UNQUOTE(JSON_SEARCH(tags, 'one', 'baby-massage')))
  WHERE handle = 'black-mustard-oil' AND JSON_CONTAINS(tags, '"baby-massage"');
UPDATE products SET tags = JSON_ARRAY_APPEND(COALESCE(tags, JSON_ARRAY()), '$', 'joint-massage')
  WHERE handle IN ('black-mustard-oil', 'castor-oil', 'walnut-oil') AND NOT JSON_CONTAINS(COALESCE(tags, JSON_ARRAY()), '"joint-massage"');
