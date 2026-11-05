-- Visitors who shared name + phone through the storefront welcome-offer popup.
-- One row per phone; a repeat submit refreshes name/page but keeps the first capture time.
CREATE TABLE leads (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  phone        VARCHAR(10)  NOT NULL UNIQUE,
  source       VARCHAR(20)  NOT NULL DEFAULT 'popup',
  page         VARCHAR(255) NULL,                       -- path the popup was shown on
  coupon_code  VARCHAR(30)  NULL,                       -- code we showed them
  cart_token   CHAR(32)     NULL,                       -- smp_cid at capture time, if any
  contacted_at DATETIME     NULL,                       -- last WhatsApp follow-up from admin
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_leads_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
