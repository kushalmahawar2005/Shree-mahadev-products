-- GST credit notes against an issued invoice (refunds, cancellations, returns).
CREATE TABLE credit_note_sequences (
  fy VARCHAR(9) NOT NULL PRIMARY KEY,
  next_seq INT UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE credit_notes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  credit_note_no VARCHAR(40) NOT NULL UNIQUE,
  fy VARCHAR(9) NOT NULL,
  seq INT UNSIGNED NOT NULL,
  note_date DATE NOT NULL,
  -- What caused it, so the same event never issues two notes: "refund:<id>" or "order:<status>".
  source_key VARCHAR(60) NOT NULL,
  refund_id INT UNSIGNED NULL,
  amount INT UNSIGNED NOT NULL,          -- whole rupees credited (incl. GST)
  reason VARCHAR(255) NULL,
  snapshot JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_credit_notes_fy_seq (fy, seq),
  UNIQUE KEY uq_credit_notes_source (order_id, source_key),
  KEY idx_credit_notes_order (order_id),
  CONSTRAINT fk_credit_notes_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_credit_notes_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
