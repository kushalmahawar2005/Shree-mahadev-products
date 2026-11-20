-- Login with email (for shoppers without WhatsApp), 20 Nov 2026.
-- A 6-digit code is emailed (hash stored, never the code). After a correct code:
--   * an account with this verified email → signed in;
--   * otherwise a one-time signup token (hash) lets the shopper add their mobile number next.
CREATE TABLE IF NOT EXISTS email_otps (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email              VARCHAR(160) NOT NULL,
  code_hash          CHAR(64)     NOT NULL,
  attempts           TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at         DATETIME     NOT NULL,
  used_at            DATETIME     NULL,
  signup_token_hash  CHAR(64)     NULL,
  signup_expires_at  DATETIME     NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_email_otps_email (email, id),
  KEY idx_email_otps_signup (signup_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
