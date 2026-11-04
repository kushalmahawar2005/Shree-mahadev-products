ALTER TABLE collections
  ADD COLUMN seo_title VARCHAR(160) NULL AFTER image_url,
  ADD COLUMN seo_description VARCHAR(320) NULL AFTER seo_title,
  ADD COLUMN in_menu TINYINT(1) NOT NULL DEFAULT 0 AFTER sort_order,
  ADD COLUMN menu_order INT NOT NULL DEFAULT 0 AFTER in_menu,
  ADD COLUMN show_homepage TINYINT(1) NOT NULL DEFAULT 0 AFTER menu_order;

UPDATE collections SET in_menu = 1, menu_order = CASE handle
  WHEN 'wood-pressed-oils' THEN 1
  WHEN 'raw-honey' THEN 2
  WHEN 'natural-sweeteners' THEN 3
  WHEN 'bestsellers' THEN 4
  ELSE 100
END WHERE handle IN ('wood-pressed-oils', 'raw-honey', 'natural-sweeteners', 'bestsellers');

UPDATE collections SET show_homepage = 1 WHERE handle = 'bestsellers';

CREATE TABLE redirects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_path VARCHAR(500) NOT NULL UNIQUE,
  destination_path VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
