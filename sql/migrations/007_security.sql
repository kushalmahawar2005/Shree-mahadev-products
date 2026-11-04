-- Admin accounts with hashed passwords, and persistent rate limits.
CREATE TABLE admin_users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(60)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,          -- scrypt$N$r$p$salt$hash
  role            VARCHAR(12)  NOT NULL DEFAULT 'owner',
  session_version INT UNSIGNED NOT NULL DEFAULT 1, -- bump to log out everywhere
  last_login_at   DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rate_limits (
  bucket      VARCHAR(120) NOT NULL PRIMARY KEY,   -- e.g. "login:1.2.3.4"
  hits        INT UNSIGNED NOT NULL,
  window_ends DATETIME     NOT NULL,
  KEY idx_rl_window (window_ends)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
