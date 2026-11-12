-- Customer profile & security (account Phase 6): personal details, email verification,
-- communication preferences, deletion request, and device info on login sessions.
ALTER TABLE customers
  ADD COLUMN dob                  DATE         NULL AFTER email,
  ADD COLUMN gender               VARCHAR(12)  NULL AFTER dob,               -- female | male | other | na
  ADD COLUMN email_verified_at    DATETIME     NULL AFTER gender,
  ADD COLUMN email_verify_hash    CHAR(64)     NULL AFTER email_verified_at, -- sha256 of the emailed token
  ADD COLUMN email_verify_expires DATETIME     NULL AFTER email_verify_hash,
  ADD COLUMN pref_wa_orders       TINYINT(1)   NOT NULL DEFAULT 1,
  ADD COLUMN pref_sms_orders      TINYINT(1)   NOT NULL DEFAULT 1,
  ADD COLUMN pref_wa_offers       TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN pref_email_offers    TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN message_language     VARCHAR(5)   NOT NULL DEFAULT 'en',        -- en | hi
  ADD COLUMN delete_requested_at  DATETIME     NULL,                         -- 7-day grace, cleared on next login
  ADD COLUMN last_login_at        DATETIME     NULL,
  ADD KEY idx_customers_delete (delete_requested_at);

ALTER TABLE customer_sessions
  ADD COLUMN user_agent   VARCHAR(255) NULL,
  ADD COLUMN ip           VARCHAR(45)  NULL,
  ADD COLUMN city         VARCHAR(80)  NULL,
  ADD COLUMN last_seen_at DATETIME     NULL,
  ADD KEY idx_customer_sessions_customer (customer_id, last_seen_at);

-- OTPs for signed-in account actions (change number, delete account). Kept apart from the
-- login otp_codes table so an account-action code can never be used to sign in.
CREATE TABLE account_otps (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  purpose     VARCHAR(16)  NOT NULL,   -- change_phone | delete
  phone       VARCHAR(10)  NOT NULL,   -- number the code was sent to
  code_hash   CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  used_at     DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_account_otps_lookup (customer_id, purpose, created_at),
  CONSTRAINT fk_account_otps_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
