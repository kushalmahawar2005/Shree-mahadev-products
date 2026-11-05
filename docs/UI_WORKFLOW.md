# UI workflow & session context (admin + storefront redesign)

> Read this before any UI work. It records how the owner wants work done, the
> library setup, the patterns already established, gotchas we hit, and what is
> done vs pending. Project-wide rules (brand, tokens, catalog, copy) live in
> `../AGENTS.md` (one level up) and still apply.

Last updated: 2026-11-05.

---

## 1. How the owner wants to work

- **Language:** owner writes Hinglish. Reply in short Hinglish. Caveman mode is on
  globally (terse chat, ≤1 line per step, short final bullet list). Code, comments
  and commit messages stay normal English quality.
- **Goal:** a very premium site. Level of Two Brothers / Cowberry / Creed Organics,
  and modern SaaS admin polish (Linear/Vercel-style) for the admin.
- **Proper libraries only.** Build on established component libraries, not hand-rolled
  one-offs. Pick the best fit per piece:
  - Foundation: **shadcn/ui** (Radix, "new-york" style) in `src/components/shadcn/`.
  - Motion: **motion** (`motion/react`): `AnimatePresence`, `Reorder` for drag lists.
  - Premium bits: **Magic UI** (registry `@magicui`, e.g. `number-ticker`), Aceternity,
    React Bits, Animate UI, Origin UI, ReUI. 21st.dev MCP is available to browse.
  - Charts: shadcn Charts (Recharts). Command palette: cmdk (shadcn `command`).
  - Icons: lucide-react.
  - If nothing fits and you hand-roll, say so in one line.
- **Flow the owner uses:** sends a screenshot of a page → "iseko proper karde". Then:
  1. Read the page + its components (targeted reads).
  2. List real problems briefly only if asked ("kami lag rahi hai kya?"); otherwise just build.
  3. Rebuild with the patterns below, keep all existing behaviour/server actions.
  4. Verify (section 6), then a short bullet summary.
- **Deadline:** full site promised to the client in 20 days from 2026-11-05 (~2026-11-25).
  Polish what exists; don't add new features unless asked.
- **Order agreed:** admin panel first → storefront UI (home page etc.) → real data/photo
  import from the old WooCommerce site → Hostinger deploy → live PayU/NimbusPost test.
- **Commits:** only when the owner asks. Work is currently **uncommitted** (see §8).

---

## 2. Library setup (already installed)

| Package | Use |
|---|---|
| `radix-ui`, `class-variance-authority`, `tw-animate-css` | shadcn primitives + animations |
| `lucide-react` | icons |
| `cmdk` | ⌘K palette |
| `recharts` | charts via `src/components/shadcn/chart.tsx` |
| `react-day-picker`, `date-fns` | calendar / date range |
| `motion` | animation, `Reorder` drag-and-drop |

shadcn components present in `src/components/shadcn/`: alert-dialog, avatar, badge,
breadcrumb, button, calendar, card, chart, command, dialog, dropdown-menu, input,
number-ticker (Magic UI), popover, scroll-area, separator, sheet, sidebar, skeleton,
switch, table, textarea, tooltip. Hook: `src/hooks/use-mobile.ts`.

### Adding a shadcn / Magic UI component (IMPORTANT gotchas)

```bash
yes n | pnpm dlx shadcn@latest add <name>          # "n" = never overwrite existing files
# Magic UI:  yes n | pnpm dlx shadcn@latest add @magicui/<name>
# then ALWAYS:
perl -pi -e 's#from "cn"#from "@/lib/utils/cn"#' src/components/shadcn/*.tsx
grep -q '"cn"' package.json && pnpm remove cn
```

- The CLI writes `import { cn } from "cn"` and adds a bogus `cn` npm package. Fix as above.
- macOS is case-insensitive: shadcn's `button.tsx` once **overwrote the storefront
  `src/components/ui/Button.tsx`**. That's why shadcn lives in `src/components/shadcn/`
  (`components.json` → `"ui": "@/components/shadcn"`). Never add shadcn into `components/ui/`.
- After adding, fix lint issues shadcn ships with (e.g. we rewrote `use-mobile.ts` with
  `useSyncExternalStore`, and made `SidebarMenuSkeleton` width pure).
- Sidebar container uses `h-auto` (not `h-svh`) so it always fills the viewport.

---

## 3. Theme & tokens

All in `src/app/globals.css`.

- Brand tokens from AGENTS.md (forest, mustard, khaki…) are unchanged.
- **Admin surface tokens** (use these in admin, never raw hex or `bg-white`):
  `bg-surface` (cards/inputs), `bg-canvas` (page), `bg-subtle` (nested panels),
  `text-forest-fg` (forest used as text/link colour), `bg-warm` / `bg-warm-strong` /
  `border-warm-line` (attention panels), `text-alert` / `bg-alert-soft`,
  `text-ink`, `text-ink-muted`, `border-line`, `bg-khaki-soft` (hover/chips).
- **Dark mode (admin only):** `html[data-admin-theme="dark"]` overrides the tokens.
  Set before paint by `src/components/admin/theme-script.ts` (localStorage
  `smp_admin_theme`, follows OS until chosen). Toggle: `ThemeToggle.tsx` (circular
  View Transition reveal; icon animates only after a click).
  `dark:` Tailwind variant = that attribute (`@custom-variant dark`). Storefront has no dark mode.
- **shadcn tokens** (`--background`, `--card`, `--primary`, `--sidebar`…) are mapped onto
  the brand/admin tokens at the end of `globals.css`, so shadcn components follow the theme
  automatically. Sidebar is deep forest in both themes.
- Text on forest buttons is `text-white`. Primary button: `bg-forest hover:bg-forest-mid`.

---

## 4. Established admin patterns (copy these)

- **Shell:** `src/components/admin/AdminShell.tsx` = shadcn `Sidebar` (collapsible to
  icons, lucide icon per item, role-filtered via `navForRole`), header with breadcrumb,
  ⌘K button (`CommandMenu.tsx`, `openCommandMenu()`), ThemeToggle, avatar dropdown
  (storefront, settings, logout). `ADMIN_NAV` is the single nav list.
- **Card style:** `rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]`.
- **Page heading:** `h1 text-3xl font-bold tracking-tight text-forest-text` + one muted
  line; primary action as a pill (`h-10 rounded-full bg-forest px-5`) with lucide icon.
- **Summary stat cards** (4-up grid) at the top of list pages: icon tile in
  `bg-khaki-soft text-forest-fg`, `tone="warn"` uses warm tokens.
- **Section/Panel:** icon tile + bold title + small hint (see `ProductForm.tsx` `Section`,
  order page `Panel`).
- **Toolbars:** segmented status tabs in a `rounded-full border p-1` pill; category pills;
  search-as-you-type (debounced `router.replace`, spinner while pending, clear ✕).
- **Tables:** no uppercase headers; `text-xs text-ink-muted` header; row hover `bg-subtle`;
  whole row clickable via `after:absolute after:inset-0` on the main link; row actions in a
  `⋯` DropdownMenu; mobile = cards.
- **Bulk actions:** floating bottom bar (`ProductsTable.tsx`), motion slide-in.
- **Editors:** sticky header under the top bar (`sticky top-16`, back button, title, status,
  "Unsaved changes", Discard, Save, ⌘S), `beforeunload` warning when dirty, inline validation
  before save, two columns (main + `xl:sticky` side column). See `ProductForm.tsx`,
  `CollectionEditor.tsx`.
- **Confirmations:** never `window.confirm/prompt`. Use `admin/order/ConfirmAction.tsx`
  (AlertDialog, optional required reason) or AlertDialog directly.
- **Small helpers:** `admin/order/CopyButton.tsx`, timelines (vertical line + dots, newest
  first), skeleton fallbacks with shadcn `Skeleton` inside `Suspense`.
- **Drag reorder:** `motion` `Reorder.Group` + `useDragControls` with a grip handle
  (`CollectionWorkspace.tsx`, `CollectionEditor.tsx`).
- **Popovers for quick edits:** e.g. inventory Adjust popover, low-stock threshold popover;
  history in a `Sheet` side drawer.
- **Numbers:** `formatMoney`, `tabular-nums`, en-IN formatting; dates via
  `Intl.DateTimeFormat("en-IN", …)` with `+05:30` (DB returns IST strings).

---

## 5. Data / backend rules (from AGENTS.md, still binding)

Raw parameterised SQL in `src/lib/server/*`, zod on every server action, `requireAdmin()`
first in admin actions, new columns = new migration, money = whole rupees, order status
changes via helpers (→ `order_events`), `updateTag()` after storefront data changes.
Additions this session:
- `src/lib/server/order-detail.ts` → `getOrderExtras()` (payments, invoice, customer summary).
- `payu-process.ts` → `reconcileOne()` + `verifyOrderPayment(orderId)`;
  `admin-actions.ts` → `verifyPaymentAction`.
- Dashboard cart conversion counts only carts whose order is in `PLACED`.
- `listInventory()` also returns `swatch` and first `image`.

---

## 6. Verify every change

1. `pnpm exec tsc --noEmit`
2. `pnpm exec eslint <changed paths>`
3. `pnpm build` (must exit 0)
4. Browser check with Claude-in-Chrome on `http://localhost:3000` (owner is logged in):
   light + dark, open dialogs/popovers, check console errors.
   - **Never click buttons that change real data while testing** (save, book shipment,
     refund, cancel, "Check with PayU", stock save). Open dialogs and press Escape.
     Lesson: on 2026-11-05 a stray click ran "Check with PayU" on test order SMP1182
     and moved it to Payment failed (owner said leave it, clean up later).
   - If CSS/tokens look stale: Turbopack cache. Kill the dev server, `rm -rf .next/dev`,
     `pnpm dev` again.
5. Tell the owner plainly what was and wasn't verified.

Dev server: `pnpm dev` on port 3000 (owner may ask to kill other local servers first).
A console error "NotSupportedError: no supported source" appears with location `:0:0`;
not from admin code (likely a browser extension). Not investigated.

---

## 7. Status

**Admin pages redesigned (done):**
- Dashboard `/admin`: KPI cards (NumberTicker + sparklines), sales area chart vs previous
  period, date range picker, task bar, stock watch, orders table with live search,
  secondary panels.
- Order detail `/admin/orders/view?id=`: progress stepper, items with photos, Payment
  panel (PayU attempts, Check with PayU, refunds), Shipping (NimbusPost booking, label,
  pickup, tracking timeline), customer card, invoice card, emails, history.
- Products list `/admin/products`, edit + add `/admin/products/edit`.
- Inventory `/admin/inventory`.
- Collections list `/admin/categories` and edit `/admin/categories/[handle]`.
- Shell: sidebar, header, ⌘K, dark mode.

**Admin pages still old style (next candidates):** Orders list `/admin/orders`, Customers
(+ view), Abandoned carts, Coupons (`discounts`), Reviews, Bulk inquiries, Marketing,
Messages, Shipping ops, Reports, Hero banners, Videos, Settings, Admin users, Activity
log, login page, `ProductImageManager` / `DropZone` styling.

**Then:** storefront redesign (home, PDP, shop, cart drawer) with the same library-first
approach (Magic UI / Aceternity / motion for premium feel, within AGENTS.md motion rules),
then real data + photo import from the old WooCommerce site (Hostinger WordPress MCP is
connected; read-only unless the owner approves).

---

## 8. Open items

- All work since commit `6207bb2` is **uncommitted**. Commit only when asked.
- SMP1182 (test order) is "Payment failed" due to the stray PayU check; owner: leave it,
  remove/clean later.
- Mobile (390px) view of the new admin pages not yet checked in a real narrow window.
- Real shipped order not available to visually verify the NimbusPost tracking/label UI.
