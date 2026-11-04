CREATE TABLE whatsapp_outbox (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NULL,
  cart_id INT UNSIGNED NULL,
  template VARCHAR(80) NOT NULL,
  to_phone VARCHAR(20) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  provider_id VARCHAR(160) NULL,
  error VARCHAR(255) NULL,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  dedupe_key VARCHAR(180) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_whatsapp_dedupe (dedupe_key),
  KEY idx_whatsapp_due (status, next_attempt_at),
  KEY idx_whatsapp_phone (to_phone),
  CONSTRAINT fk_whatsapp_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_whatsapp_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE whatsapp_optouts (
  phone VARCHAR(20) PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE whatsapp_templates (
  template VARCHAR(80) PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO whatsapp_templates (template) VALUES
  ('order_placed'), ('cod_confirmation'), ('shipped'), ('delivered'),
  ('cancelled'), ('abandoned_cart_1h'), ('abandoned_cart_24h'), ('back_in_stock')
ON DUPLICATE KEY UPDATE template = VALUES(template);
