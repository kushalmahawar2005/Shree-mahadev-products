-- PayU refunds (full or partial). One row per refund request.
CREATE TABLE refunds (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     INT UNSIGNED NOT NULL,
  payment_id   INT UNSIGNED NOT NULL,
  amount       INT UNSIGNED NOT NULL,
  reason       VARCHAR(255) NULL,
  token        VARCHAR(40)  NOT NULL UNIQUE,      -- our idempotency id sent to PayU
  status       VARCHAR(12)  NOT NULL DEFAULT 'requested', -- requested | success | failed
  provider_ref VARCHAR(60)  NULL,
  error        VARCHAR(255) NULL,
  created_by   VARCHAR(60)  NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_refunds_order (order_id),
  CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
