-- Built-in ghani clips become real reels, 21 Nov 2026.
-- Until now the home page (and its phone stories) and oil product pages showed these from code when
-- no reel was ticked, so admin listed 0. As rows they show in admin and can be re-ordered, re-tagged,
-- hidden or deleted. public_id is empty on purpose: deleting the row never deletes our own Cloudinary file.
-- Each insert is skipped when a reel with that video already exists (safe to re-run).
INSERT INTO reels (public_id, video_url, width, height, caption, product_handle, sort_order, active, placements)
SELECT '', 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/ghani-1.mp4', 720, 1280, 'Fresh coconut going into the ghani', 'coconut-oil', (SELECT COALESCE(MAX(r.sort_order), -1) + 1 FROM reels r), 1, JSON_ARRAY('home','oil')
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM reels WHERE video_url = 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/ghani-1.mp4');
INSERT INTO reels (public_id, video_url, width, height, caption, product_handle, sort_order, active, placements)
SELECT '', 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/ghani-2.mp4', 720, 1280, 'Slow pressing, no heat', 'black-mustard-oil', (SELECT COALESCE(MAX(r.sort_order), -1) + 1 FROM reels r), 1, JSON_ARRAY('home','oil')
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM reels WHERE video_url = 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/ghani-2.mp4');
INSERT INTO reels (public_id, video_url, width, height, caption, product_handle, sort_order, active, placements)
SELECT '', 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/oil-pour.mp4', 720, 1280, 'Golden oil, straight from the press', 'yellow-mustard-oil', (SELECT COALESCE(MAX(r.sort_order), -1) + 1 FROM reels r), 1, JSON_ARRAY('home','oil')
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM reels WHERE video_url = 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/oil-pour.mp4');
INSERT INTO reels (public_id, video_url, width, height, caption, product_handle, sort_order, active, placements)
SELECT '', 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/ghani-3.mp4', 720, 1280, 'Settled, filtered, bottled by hand', 'groundnut-oil', (SELECT COALESCE(MAX(r.sort_order), -1) + 1 FROM reels r), 1, JSON_ARRAY('home','oil')
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM reels WHERE video_url = 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/ghani-3.mp4');
INSERT INTO reels (public_id, video_url, width, height, caption, product_handle, sort_order, active, placements)
SELECT '', 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/bottling.mp4', 720, 1280, 'Filtered and filled, batch by batch', 'sunflower-oil', (SELECT COALESCE(MAX(r.sort_order), -1) + 1 FROM reels r), 1, JSON_ARRAY('home','oil')
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM reels WHERE video_url = 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/bottling.mp4');
INSERT INTO reels (public_id, video_url, width, height, caption, product_handle, sort_order, active, placements)
SELECT '', 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/ghani-pour.mp4', 720, 1280, 'Golden oil from the wooden ghani', 'white-sesame-oil', (SELECT COALESCE(MAX(r.sort_order), -1) + 1 FROM reels r), 1, JSON_ARRAY('home','oil')
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM reels WHERE video_url = 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/ghani-pour.mp4');
INSERT INTO reels (public_id, video_url, width, height, caption, product_handle, sort_order, active, placements)
SELECT '', 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/coconut-in.mp4', 720, 1280, 'Clean coconut, straight into the press', 'coconut-oil', (SELECT COALESCE(MAX(r.sort_order), -1) + 1 FROM reels r), 1, JSON_ARRAY('home')
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM reels WHERE video_url = 'https://res.cloudinary.com/bmqxsylj/video/upload/swadeshi-mahadev/videos/reels/coconut-in.mp4');
