-- Transactional email outbox: every message is rendered and stored first, then sent by a worker
-- with retries, so a slow or failing mail provider never blocks checkout.
CREATE TABLE email_outbox (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      INT UNSIGNED NULL,
  template      VARCHAR(30)  NOT NULL,   -- order_placed | payment_received | shipped | delivered | cancelled | refund | store_new_order
  to_email      VARCHAR(160) NOT NULL,
  subject       VARCHAR(200) NOT NULL,
  html          MEDIUMTEXT   NOT NULL,
  text_body     TEXT         NOT NULL,
  dedupe_key    VARCHAR(120) NULL,       -- same event never queued twice; NULL for manual resends
  status        VARCHAR(12)  NOT NULL DEFAULT 'pending',  -- pending | sending | sent | failed
  attempts      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider_id   VARCHAR(80)  NULL,
  error         VARCHAR(255) NULL,
  sent_at       DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_outbox_dedupe (dedupe_key),
  KEY idx_outbox_due (status, next_attempt_at),
  KEY idx_outbox_order (order_id),
  CONSTRAINT fk_outbox_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
