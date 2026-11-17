-- Chat assistant: question log (for "unanswered" review) and owner-written answers
-- that the assistant uses as store knowledge.
CREATE TABLE chat_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(24) NULL,
  msg_key VARCHAR(24) NULL,
  feedback TINYINT NULL,
  question VARCHAR(500) NOT NULL,
  answer TEXT NULL,
  engine ENUM('ai','cache','local','orders','medical') NOT NULL,
  answered TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('new','resolved','ignored') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chat_logs_msg (msg_key),
  KEY idx_chat_logs_created (created_at),
  KEY idx_chat_logs_open (answered, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_answers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question VARCHAR(300) NOT NULL,
  answer TEXT NOT NULL,
  keywords VARCHAR(500) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
