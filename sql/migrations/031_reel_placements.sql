-- Where each reel shows on the site: one Reels page in admin with "show on" ticks.
-- Values: "home" (homepage reels), "oil" / "honey" / "sweetener" (product pages of that category).
-- Existing reels were homepage reels, so they keep showing there.
ALTER TABLE reels ADD COLUMN placements JSON NULL AFTER active;
UPDATE reels SET placements = JSON_ARRAY('home') WHERE placements IS NULL;
