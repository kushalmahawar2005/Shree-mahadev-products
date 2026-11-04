ALTER TABLE inquiries
  MODIFY status VARCHAR(12) NOT NULL DEFAULT 'new',
  ADD COLUMN assignee VARCHAR(60) NULL AFTER status,
  ADD COLUMN follow_up_at DATE NULL AFTER assignee,
  ADD COLUMN quote_amount INT UNSIGNED NULL AFTER follow_up_at,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD KEY idx_inquiries_follow_up (status, follow_up_at);

CREATE TABLE inquiry_notes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inquiry_id INT UNSIGNED NOT NULL,
  author     VARCHAR(60) NOT NULL,
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inquiry_notes (inquiry_id, created_at),
  CONSTRAINT fk_inquiry_notes_inquiry FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
