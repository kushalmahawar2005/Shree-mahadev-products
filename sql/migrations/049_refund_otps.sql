-- Refund approval by email OTP, 21 Nov 2026.
-- Before any refund, a 6-digit code goes to the owner's inbox (REFUND_OTP_EMAIL). The code is tied to
-- one order + one amount, works for 10 minutes, 5 guesses, once. Only the hash is stored.
CREATE TABLE IF NOT EXISTS refund_otps (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  amount      INT UNSIGNED NOT NULL,
  admin_user  VARCHAR(60)  NOT NULL,
  code_hash   CHAR(64)     NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_refund_otps_lookup (order_id, admin_user, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
