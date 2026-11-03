-- Short vertical videos (Instagram reels) shown on the homepage. Files live on Cloudinary.
CREATE TABLE reels (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id      VARCHAR(255) NOT NULL,
  video_url      VARCHAR(500) NOT NULL,
  width          INT UNSIGNED NOT NULL,
  height         INT UNSIGNED NOT NULL,
  duration       DECIMAL(6,1) NULL,
  caption        VARCHAR(160) NOT NULL DEFAULT '',
  product_handle VARCHAR(80)  NULL,
  instagram_url  VARCHAR(500) NULL,
  sort_order     INT          NOT NULL DEFAULT 0,
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reels_active (active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
