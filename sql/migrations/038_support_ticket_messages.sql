-- Conversation on a help ticket: team replies the customer sees in My requests, and the customer's
-- follow-ups. The ticket's first message stays in support_tickets.message.
CREATE TABLE support_ticket_messages (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id   INT UNSIGNED NOT NULL,
  author      VARCHAR(10)  NOT NULL,                     -- team | customer
  author_name VARCHAR(60)  NOT NULL DEFAULT '',
  body        VARCHAR(2000) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ticket_messages (ticket_id, id),
  CONSTRAINT fk_ticket_messages_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- When the customer last opened the ticket, for the "new reply" badge.
ALTER TABLE support_tickets ADD COLUMN customer_seen_at DATETIME NULL AFTER status;
