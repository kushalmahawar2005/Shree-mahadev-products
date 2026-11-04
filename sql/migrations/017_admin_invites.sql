CREATE TABLE admin_invites (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(160) NOT NULL,
  role            VARCHAR(12) NOT NULL,
  token_hash      CHAR(64) NOT NULL UNIQUE,
  expires_at      DATETIME NOT NULL,
  used_at         DATETIME NULL,
  created_by      VARCHAR(60) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_invites_email (email),
  KEY idx_admin_invites_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
