-- "Was this review helpful?" count shown on product pages (one vote per browser, rate limited per IP).
ALTER TABLE reviews ADD COLUMN helpful INT UNSIGNED NOT NULL DEFAULT 0 AFTER featured;
