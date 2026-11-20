-- Self-hosted error monitoring: every server error (pages, API routes, server actions) and browser
-- crash, grouped by fingerprint so a repeating error is one row with a count. Viewed at /admin/errors.
CREATE TABLE error_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fingerprint CHAR(40)      NOT NULL,                  -- sha1(source | route | normalised message)
  source      VARCHAR(10)   NOT NULL,                  -- server | client
  route_type  VARCHAR(20)   NULL,                      -- render | route | action | proxy | browser
  route       VARCHAR(300)  NULL,                      -- route file, e.g. /(site)/(shop)/checkout/page
  path        VARCHAR(300)  NULL,                      -- last URL path seen (query string dropped)
  method      VARCHAR(10)   NULL,
  message     VARCHAR(1000) NOT NULL,
  stack       TEXT          NULL,
  digest      VARCHAR(64)   NULL,
  count       INT UNSIGNED  NOT NULL DEFAULT 1,
  resolved    TINYINT(1)    NOT NULL DEFAULT 0,
  first_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_error_fingerprint (fingerprint),
  KEY idx_error_open (resolved, last_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
