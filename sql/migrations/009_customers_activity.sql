ALTER TABLE customers
  MODIFY notes TEXT NULL,
  ADD COLUMN tags JSON NULL AFTER notes;

CREATE TABLE activity_log (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_username VARCHAR(60)  NOT NULL,
  action         VARCHAR(80)  NOT NULL,
  target         VARCHAR(160) NULL,
  meta           JSON         NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activity_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
