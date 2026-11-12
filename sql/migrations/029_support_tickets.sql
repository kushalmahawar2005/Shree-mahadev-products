-- Customer help requests from /account/help ("Get help with an order"), their photos,
-- and 👍/👎 counts per help-centre FAQ answer.
CREATE TABLE support_tickets (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_no     VARCHAR(20)  NULL,                       -- "HLP-1042" (set right after insert from the id)
  customer_id   INT UNSIGNED NOT NULL,
  order_id      INT UNSIGNED NULL,                       -- NULL = not about a specific order
  issue         VARCHAR(40)  NOT NULL,                   -- issue key, e.g. damaged, where_is_order
  message       VARCHAR(500) NOT NULL DEFAULT '',
  utr           VARCHAR(40)  NULL,                       -- UPI / bank reference for "money deducted"
  contact_pref  VARCHAR(10)  NOT NULL DEFAULT 'whatsapp', -- whatsapp | call
  callback_slot VARCHAR(40)  NULL,
  status        VARCHAR(12)  NOT NULL DEFAULT 'open',    -- open | in_progress | resolved
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_support_ticket_no (ticket_no),
  KEY idx_support_customer (customer_id, id),
  KEY idx_support_status (status, created_at),
  CONSTRAINT fk_support_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_support_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_ticket_photos (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id  INT UNSIGNED NOT NULL,
  url        VARCHAR(500) NOT NULL,
  public_id  VARCHAR(200) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_support_photos_ticket (ticket_id),
  CONSTRAINT fk_support_photos_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE faq_feedback (
  faq_id      VARCHAR(80)  PRIMARY KEY,                  -- id from src/content/faqs.ts
  helpful     INT UNSIGNED NOT NULL DEFAULT 0,
  not_helpful INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
