# Client feedback TODO — "Problem" WhatsApp group (20 Nov 2026)

Source: owner's screenshots of the "Problem" group (messages 1:08 PM – 3:48 PM).
Work one item at a time. `?` = not clear yet, owner explains when its turn comes.
Status: [ ] todo · [~] in progress · [x] done

## A. Photos / artwork

1. [ ] **Home hero banner** (Diwali "इस दीपावली पर अपनाएं शुद्धता" slide) — "Ye photo change krna h". `?` Which new photo, or is it a new design?
2. [x] **Black Sesame Oil photo missing** (photos were only in local DB; migration 043 copies them live on deploy) — shows an empty placeholder bottle in the Wood-Pressed Oils mega menu, in the shop/use carousels and on the product cards. Needs a real cut-out.
3. [x] **Natural Sweeteners mega menu → "Bulk orders" tile** — shows the oil bottle photo. "Bulk m oil ka same photo shi he ya phir dusre products ka bhi add kre". Show sweetener/other products too (or a mixed photo). Done: `public/illustrations/bulk-sweeteners.webp`.
4. [ ] **"पहले फ़र्क देखिए" compare slider** (wood-pressed vs refined) — "Isme photo update ke sa sath effect dalna ki slide hota he". Client sent a new artwork at 2:17 PM (Dadi + WOOD-PRESSED illustration with ghani, Day 1 / Day 5 jars). Use the new artwork + add a slide/reveal effect. `?` Exact effect is in the voice notes (see E).
5. [x] **Baby massage use-case card** (Dadi with baby) — "Dadi ka photo match nhi he". The Dadi face doesn't match the brand Dadi used elsewhere. Swap to a matching image.
6. [ ] **Groundnut seeds in the process artwork** — "Groundnut ke seed dikha dena" (About/process "जैसा हमारे ज़माने में बनता था" → Farm sourced step) and on the Groundnut Oil product page's "How it's made" step 1 ("Groundnut Seed"). Show groundnut seeds, not a generic plant.

## B. Shop-by-use lists (home + shop page carousels)

7. [x] **Daily cooking** — move Coconut Oil to position 4.
8. [x] **Hair & skin** — final list in this order: Coconut, Almond, Black sesame, Yellow mustard, Black mustard, Walnut, Castor, Flaxseed. **Remove Brown sesame.**
9. [x] **New use category** ("Joint malish", tag `joint-massage`; own scene photo added 20 Nov)
   Was: **New use category: Joint pain / heel (एड़ी) pain / body malish** — products: Black mustard, Castor, Walnut. Needs a name, a short line, and a card photo.
10. [x] **Baby massage** — remove Black mustard; put Yellow mustard just before Black sesame.

## C. Product pages (PDP)

11. [x] **Coconut Oil** — hide the "How it's made" section.
12. [x] **White Sesame Oil** (About rewritten with all oils, 044) — "How it's made" removed (all products, owner 20 Nov). `?` The "About" screenshot (1:30 PM) has no instruction; ask if the About text needs a change.
13. [x] **Brown Sesame Oil** — About: add "Marwadi seed" (Marwari seeds). Remove "How it's made".
14. [x] **Black Sesame Oil** — About: say it is sourced from Gujarat. Remove "How it's made".
15. [ ] **Black Mustard Oil** — "Black mustard me shi krna h". `?` What is wrong (About text / highlights / photo)?
16. [ ] **Groundnut Oil — "Kachi ghani vs refined" block** — caption "Lakdi kachi gani". Make the wording "लकड़ी कच्ची घानी" (wooden kachi ghani). `?` Confirm whether it is a heading/text change or a photo change.
17. [ ] **Raw Honey — "Know raw honey at home"** (3 cards) — keep card 1 (It may crystallise); replace card 3 (Taste the flower) with the test shown in the client's video. `?` Need the video from the group.

## D. Login / account

18. [x] **OTP on both email and WhatsApp** (live 20 Nov: WhatsApp | Email toggle, login popup) — "Otp option me mail and whatsapp dono dena". On login, let the customer choose email OTP or WhatsApp OTP.

## E. Not readable from screenshots

19. [ ] **3 voice notes** from Shree Mahadev Products (2:15 PM 0:28, 2:17 PM 0:10, 2:17 PM 0:02). Probably about item 4 (the new Wood-Pressed artwork). Owner to listen and tell.
20. [ ] **Deleted message at 3:48 PM**. Ignore unless the client resends it.

## Done notes (20 Nov)
- "How it's made" accordion row removed from every product page (owner).
- Tags: migration `041_shop_by_use_tags.sql`; About text: `042_sesame_about_2026_11_20.sql`. Both run on deploy.
- List order lives in `src/data/home.ts` (`order`).
- About text of all 12 oils rewritten (traditional Kolhu + 10-day gravity sedimentation): migration `044_oil_about_text.sql`.
