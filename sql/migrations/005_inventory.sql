-- Inventory: per-order stock holds, an audit log of every stock change, and back-in-stock requests.

-- One row per order line for tracked variants.
-- held      = PayU order waiting for payment (expires_at), stock already taken
-- committed = sold (COD placed or PayU paid)
-- released  = payment failed/expired before paying, stock returned
-- restocked = order cancelled / RTO received after commit, stock returned
CREATE TABLE stock_reservations (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  variant_key VARCHAR(100) NOT NULL,
  quantity    INT UNSIGNED NOT NULL,
  status      VARCHAR(10)  NOT NULL,
  expires_at  DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_res_order (order_id),
  KEY idx_res_expiry (status, expires_at),
  CONSTRAINT fk_res_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every stock movement, by admin or by the system.
CREATE TABLE inventory_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variant_key VARCHAR(100) NOT NULL,
  delta       INT          NOT NULL,
  stock_after INT          NULL,
  reason      VARCHAR(20)  NOT NULL,   -- order | release | restock | rto_return | restock_manual | damaged | correction
  order_id    INT UNSIGNED NULL,
  note        VARCHAR(255) NULL,
  actor       VARCHAR(20)  NOT NULL,   -- system | admin | customer
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_invlog_variant (variant_key, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Notify me" when an out-of-stock size is back.
CREATE TABLE back_in_stock (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variant_key VARCHAR(100) NOT NULL,
  phone       VARCHAR(10)  NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME     NULL,
  UNIQUE KEY uq_bis (variant_key, phone),
  KEY idx_bis_pending (variant_key, notified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
