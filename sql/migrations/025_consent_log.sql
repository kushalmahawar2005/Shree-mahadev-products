-- Append-only log of every marketing / notification consent change (DPDP audit trail).
CREATE TABLE customer_consents (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  channel     VARCHAR(24)  NOT NULL,   -- wa_orders | sms_orders | wa_offers | email_offers
  granted     TINYINT(1)   NOT NULL,
  source      VARCHAR(40)  NOT NULL,   -- account_profile | checkout | admin | …
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_consents_customer (customer_id, created_at),
  CONSTRAINT fk_consents_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
