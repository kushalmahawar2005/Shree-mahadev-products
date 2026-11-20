/**
 * After a deploy, a browser can still be running the previous build's JavaScript (an old copy of the
 * page from the CDN, or a tab left open). Its server action IDs and lazy chunks no longer exist on the
 * server, so the first action call or chunk load fails. A single full reload fetches the new build and
 * fixes it, so error boundaries call this before showing an error page.
 */
const STALE_BUILD =
  /UnrecognizedActionError|Server Action ".*" was not found on the server|ChunkLoadError|Loading chunk .* failed|Failed to load chunk|Failed to fetch dynamically imported module/i;

const KEY = "smp_stale_reload";
const WINDOW_MS = 30_000;

export function isStaleBuildError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  return STALE_BUILD.test(`${e?.name ?? ""} ${e?.message ?? String(error)}`);
}

/** True when `error` is from an outdated build and this page has not just been reloaded for it. */
export function shouldReloadForStaleBuild(error: unknown): boolean {
  if (typeof window === "undefined" || !isStaleBuildError(error)) return false;
  try {
    const last = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { path: string; at: number } | null;
    return !(last && last.path === window.location.pathname && Date.now() - last.at < WINDOW_MS);
  } catch {
    return false; // storage blocked: can't guard against a reload loop, so show the error page instead
  }
}

/**
 * Reloads the page once when `error` comes from an outdated build. Returns true when a reload was
 * started. A second failure on the same page within 30 s is not retried, so a real bug still reaches
 * the error page instead of looping.
 */
export function reloadIfStaleBuild(error: unknown): boolean {
  if (!shouldReloadForStaleBuild(error)) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path: window.location.pathname, at: Date.now() }));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
