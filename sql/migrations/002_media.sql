-- Media lives on Cloudinary. We store the delivery URL + public_id (for deletes).
-- Product images are keyed by product handle so they work before the catalog moves to MySQL.
DROP TABLE IF EXISTS product_images;
CREATE TABLE product_images (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_handle VARCHAR(80)  NOT NULL,
  public_id      VARCHAR(255) NOT NULL,
  url            VARCHAR(500) NOT NULL,
  alt            VARCHAR(255) NOT NULL DEFAULT '',
  width          INT UNSIGNED NOT NULL,
  height         INT UNSIGNED NOT NULL,
  sort_order     INT          NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_product_images (product_handle, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE banners
  ADD COLUMN desktop_public_id VARCHAR(255) NULL AFTER image_mobile,
  ADD COLUMN mobile_public_id  VARCHAR(255) NULL AFTER desktop_public_id,
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
