-- Swadeshi Mahadev Products: full store schema. MySQL 8 / MariaDB 10.6+ (Hostinger).
-- Money = whole rupees (INT UNSIGNED). Timestamps are IST (pool timezone +05:30).
-- Variants are referenced by `variant_key` (e.g. "yellow-mustard-oil--1l"), the same id the cart uses.

-- ───────────── Catalog ─────────────
CREATE TABLE products (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  handle            VARCHAR(80)  NOT NULL UNIQUE,
  title             VARCHAR(160) NOT NULL,
  title_hi          VARCHAR(160) NULL,
  category          VARCHAR(20)  NOT NULL,              -- oil | honey | sweetener
  swatch            CHAR(7)      NULL,
  short_description VARCHAR(255) NOT NULL DEFAULT '',
  description_html  TEXT         NULL,
  benefits          JSON         NULL,                  -- string[]
  best_for          JSON         NULL,                  -- string[]
  how_to_use        TEXT         NULL,
  process_note      TEXT         NULL,
  lab_report_url    VARCHAR(500) NULL,
  shelf_life        VARCHAR(255) NULL,
  faqs              JSON         NULL,                  -- {q,a}[]
  tags              JSON         NULL,                  -- string[]
  seo_title         VARCHAR(160) NULL,
  seo_description   VARCHAR(320) NULL,
  status            VARCHAR(10)  NOT NULL DEFAULT 'active', -- active | draft | archived
  sort_order        INT          NOT NULL DEFAULT 0,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_products_status (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_variants (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id       INT UNSIGNED NOT NULL,
  variant_key      VARCHAR(100) NOT NULL UNIQUE,
  title            VARCHAR(40)  NOT NULL,               -- "1 L"
  size_value       INT UNSIGNED NOT NULL,               -- 1000
  size_unit        VARCHAR(4)   NOT NULL,               -- ml | g
  sku              VARCHAR(60)  NULL UNIQUE,
  price            INT UNSIGNED NOT NULL,
  compare_at_price INT UNSIGNED NULL,
  stock_qty        INT          NULL,                   -- NULL = not tracked
  available        TINYINT(1)   NOT NULL DEFAULT 1,
  weight_grams     INT UNSIGNED NULL,                   -- packed weight, for NimbusPost
  sort_order       INT          NOT NULL DEFAULT 0,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_images (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  url        VARCHAR(500) NOT NULL,
  alt        VARCHAR(255) NOT NULL DEFAULT '',
  width      INT UNSIGNED NOT NULL DEFAULT 800,
  height     INT UNSIGNED NOT NULL DEFAULT 800,
  sort_order INT          NOT NULL DEFAULT 0,
  CONSTRAINT fk_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE collections (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  handle      VARCHAR(80)  NOT NULL UNIQUE,
  title       VARCHAR(160) NOT NULL,
  description TEXT         NULL,
  image_url   VARCHAR(500) NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  active      TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE collection_products (
  collection_id INT UNSIGNED NOT NULL,
  product_id    INT UNSIGNED NOT NULL,
  sort_order    INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id),
  CONSTRAINT fk_cp_collection FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_product    FOREIGN KEY (product_id)    REFERENCES products(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Customers (guest checkout, keyed by phone) ─────────────
CREATE TABLE customers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone      VARCHAR(10)  NOT NULL UNIQUE,              -- 10-digit Indian mobile
  email      VARCHAR(160) NULL,
  name       VARCHAR(120) NOT NULL,
  notes      VARCHAR(500) NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE addresses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(10)  NOT NULL,
  line1       VARCHAR(255) NOT NULL,
  line2       VARCHAR(255) NULL,
  city        VARCHAR(80)  NOT NULL,
  state       VARCHAR(60)  NOT NULL,
  pincode     CHAR(6)      NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Carts (server copy of every cart, for abandoned-cart recovery) ─────────────
CREATE TABLE carts (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token            CHAR(32)     NOT NULL UNIQUE,         -- smp_cid cookie; also the recovery link
  customer_id      INT UNSIGNED NULL,
  name             VARCHAR(120) NULL,                    -- captured on checkout as they type
  phone            VARCHAR(10)  NULL,
  email            VARCHAR(160) NULL,
  pincode          CHAR(6)      NULL,
  item_count       INT UNSIGNED NOT NULL DEFAULT 0,
  subtotal         INT UNSIGNED NOT NULL DEFAULT 0,
  reached_checkout TINYINT(1)   NOT NULL DEFAULT 0,
  status           VARCHAR(12)  NOT NULL DEFAULT 'active', -- active | converted
  order_id         INT UNSIGNED NULL,
  reminder_count   INT UNSIGNED NOT NULL DEFAULT 0,
  reminder_sent_at DATETIME     NULL,
  recovered_at     DATETIME     NULL,                    -- reopened via recovery link
  last_activity_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  converted_at     DATETIME     NULL,
  KEY idx_carts_abandoned (status, last_activity_at),
  KEY idx_carts_phone (phone),
  CONSTRAINT fk_carts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cart_items (
  cart_id        INT UNSIGNED NOT NULL,
  variant_key    VARCHAR(100) NOT NULL,
  product_handle VARCHAR(80)  NOT NULL,
  product_title  VARCHAR(160) NOT NULL,
  variant_title  VARCHAR(40)  NOT NULL,
  unit_price     INT UNSIGNED NOT NULL,
  quantity       INT UNSIGNED NOT NULL,
  PRIMARY KEY (cart_id, variant_key),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Coupons ─────────────
CREATE TABLE coupons (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(30)  NOT NULL UNIQUE,
  kind         VARCHAR(10)  NOT NULL,                    -- percent | flat
  value        INT UNSIGNED NOT NULL,                    -- 10 (%) or 100 (₹)
  min_subtotal INT UNSIGNED NOT NULL DEFAULT 0,
  max_discount INT UNSIGNED NULL,
  first_order_only TINYINT(1) NOT NULL DEFAULT 0,
  usage_limit  INT UNSIGNED NULL,
  used_count   INT UNSIGNED NOT NULL DEFAULT 0,
  starts_at    DATETIME     NULL,
  ends_at      DATETIME     NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Orders ─────────────
CREATE TABLE orders (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no        VARCHAR(20)  NULL UNIQUE,              -- SMP1001
  token           CHAR(32)     NOT NULL UNIQUE,          -- private link /order/<token>
  customer_id     INT UNSIGNED NULL,
  cart_id         INT UNSIGNED NULL,
  source          VARCHAR(12)  NOT NULL DEFAULT 'web',   -- web | whatsapp | admin
  -- pending_payment | payment_failed | paid | cod_pending | confirmed | packed
  -- | shipped | delivered | cancelled | rto | refunded
  status          VARCHAR(20)  NOT NULL,
  payment_method  VARCHAR(10)  NOT NULL,                 -- payu | cod
  customer_name   VARCHAR(120) NOT NULL,                 -- address snapshot at order time
  phone           VARCHAR(10)  NOT NULL,
  email           VARCHAR(160) NOT NULL,
  address_line1   VARCHAR(255) NOT NULL,
  address_line2   VARCHAR(255) NULL,
  city            VARCHAR(80)  NOT NULL,
  state           VARCHAR(60)  NOT NULL,
  pincode         CHAR(6)      NOT NULL,
  subtotal        INT UNSIGNED NOT NULL,
  discount        INT UNSIGNED NOT NULL DEFAULT 0,
  coupon_code     VARCHAR(30)  NULL,
  shipping        INT UNSIGNED NOT NULL DEFAULT 0,
  cod_fee         INT UNSIGNED NOT NULL DEFAULT 0,
  courier_id      VARCHAR(20)  NULL,                     -- cheapest NimbusPost courier quoted at checkout
  courier_name    VARCHAR(60)  NULL,
  total           INT UNSIGNED NOT NULL,
  customer_note   VARCHAR(500) NULL,
  admin_note      VARCHAR(1000) NULL,
  paid_at         DATETIME     NULL,
  cancelled_at    DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orders_status (status, created_at),
  KEY idx_orders_phone (phone),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_cart     FOREIGN KEY (cart_id)     REFERENCES carts(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE carts ADD CONSTRAINT fk_carts_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE order_items (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id       INT UNSIGNED NOT NULL,
  variant_key    VARCHAR(100) NOT NULL,
  product_handle VARCHAR(80)  NOT NULL,
  product_title  VARCHAR(160) NOT NULL,                  -- snapshot: survives catalog edits
  variant_title  VARCHAR(40)  NOT NULL,
  sku            VARCHAR(60)  NULL,
  unit_price     INT UNSIGNED NOT NULL,
  compare_at_price INT UNSIGNED NULL,
  quantity       INT UNSIGNED NOT NULL,
  line_total     INT UNSIGNED NOT NULL,
  KEY idx_items_variant (variant_key),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_events (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  from_status VARCHAR(20)  NULL,
  to_status   VARCHAR(20)  NOT NULL,
  actor       VARCHAR(20)  NOT NULL,                     -- system | customer | admin | payu | nimbuspost
  note        VARCHAR(500) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_events_order (order_id, created_at),
  CONSTRAINT fk_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per PayU attempt (a failed attempt + retry = 2 rows).
CREATE TABLE payments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  provider    VARCHAR(12)  NOT NULL DEFAULT 'payu',
  txnid       VARCHAR(25)  NOT NULL UNIQUE,
  amount      INT UNSIGNED NOT NULL,
  status      VARCHAR(12)  NOT NULL DEFAULT 'initiated', -- initiated | success | failed | pending | refunded
  mihpayid    VARCHAR(40)  NULL,
  mode        VARCHAR(30)  NULL,                         -- UPI | CC | DC | NB ...
  error       VARCHAR(255) NULL,
  raw         JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Shipping (NimbusPost) ─────────────
CREATE TABLE shipments (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id             INT UNSIGNED NOT NULL,
  provider             VARCHAR(20)  NOT NULL DEFAULT 'nimbuspost',
  provider_shipment_id VARCHAR(60)  NULL,
  awb                  VARCHAR(40)  NULL UNIQUE,
  courier              VARCHAR(60)  NULL,
  status               VARCHAR(30)  NOT NULL DEFAULT 'booked', -- booked | picked | in_transit | out_for_delivery | delivered | rto | cancelled
  weight_grams         INT UNSIGNED NULL,
  label_url            VARCHAR(500) NULL,
  tracking_url         VARCHAR(500) NULL,
  shipped_at           DATETIME     NULL,
  delivered_at         DATETIME     NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shipments_order (order_id),
  CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shipment_events (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shipment_id INT UNSIGNED NOT NULL,
  status      VARCHAR(30)  NOT NULL,
  location    VARCHAR(120) NULL,
  message     VARCHAR(255) NULL,
  event_at    DATETIME     NOT NULL,
  KEY idx_shipment_events (shipment_id, event_at),
  CONSTRAINT fk_shipment_events FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Content & leads ─────────────
CREATE TABLE reviews (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_handle    VARCHAR(80)  NOT NULL,
  order_id          INT UNSIGNED NULL,                   -- set = verified purchase
  name              VARCHAR(120) NOT NULL,
  city              VARCHAR(80)  NULL,
  rating            TINYINT UNSIGNED NOT NULL,           -- 1..5
  title             VARCHAR(160) NULL,
  body              TEXT         NOT NULL,
  status            VARCHAR(10)  NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reviews_product (product_handle, status),
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inquiries (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind       VARCHAR(12)  NOT NULL DEFAULT 'bulk',       -- bulk | contact
  name       VARCHAR(120) NOT NULL,
  business   VARCHAR(160) NULL,
  city       VARCHAR(80)  NULL,
  phone      VARCHAR(15)  NOT NULL,
  email      VARCHAR(160) NULL,
  product    VARCHAR(160) NULL,
  quantity   VARCHAR(60)  NULL,
  message    TEXT         NULL,
  status     VARCHAR(12)  NOT NULL DEFAULT 'new',        -- new | contacted | won | lost
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inquiries_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE banners (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  placement     VARCHAR(20)  NOT NULL DEFAULT 'hero',    -- hero | promo | announcement
  title         VARCHAR(160) NOT NULL,
  subtitle      VARCHAR(255) NULL,
  image_desktop VARCHAR(500) NULL,
  image_mobile  VARCHAR(500) NULL,
  link_url      VARCHAR(500) NULL,
  cta_label     VARCHAR(40)  NULL,
  sort_order    INT          NOT NULL DEFAULT 0,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  starts_at     DATETIME     NULL,
  ends_at       DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Store-wide knobs editable from admin (shipping fee, COD fee, thresholds...)
CREATE TABLE settings (
  `key`      VARCHAR(60) PRIMARY KEY,
  value      JSON        NOT NULL,
  updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Raw PayU / NimbusPost callbacks, for debugging disputes.
CREATE TABLE webhook_logs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source      VARCHAR(20)  NOT NULL,                     -- payu | nimbuspost
  event       VARCHAR(60)  NULL,
  ref         VARCHAR(60)  NULL,                         -- txnid / awb
  payload     JSON         NOT NULL,
  received_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_webhook_ref (source, ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
