-- Second courier aggregator (Velocity Shipping), 20 Nov 2026. shipments.provider already exists
-- ('nimbuspost' | 'velocity'). Velocity label links expire after an hour with no refresh API, so the
-- PDF is kept here and served from /api/admin/shipments/:id/label.
ALTER TABLE shipments ADD COLUMN label_pdf MEDIUMBLOB NULL AFTER label_url;
