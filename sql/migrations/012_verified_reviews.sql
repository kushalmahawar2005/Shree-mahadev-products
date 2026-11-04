ALTER TABLE reviews
  ADD COLUMN reply TEXT NULL AFTER body,
  ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN source VARCHAR(12) NOT NULL DEFAULT 'site' AFTER featured,
  ADD COLUMN auto_hold_reason VARCHAR(120) NULL AFTER source,
  ADD UNIQUE KEY uq_reviews_order_product (order_id, product_handle);

CREATE TABLE review_photos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  review_id INT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL,
  public_id VARCHAR(200) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_review_photos_review (review_id),
  CONSTRAINT fk_review_photos_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
