/**
 * YouTube links → embeddable player. Plain module (client + server).
 *
 * Instagram links are intentionally NOT supported: Instagram's embed does not play reels inline for
 * logged-out visitors (it shows "Watch on Instagram" and sends people to the app). Upload the reel
 * video instead, or post it as a YouTube Short and paste that link.
 */
export type ReelLink = { kind: "youtube"; id: string };

export function parseReelLink(raw: string): { ok: true; link: ReelLink } | { ok: false; error: string } {
  // Accept pasted embed HTML too: take the first YouTube URL inside it.
  const found = raw.match(/https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s"'<>]+/i)?.[0];
  let u: URL;
  try {
    u = new URL((found ?? raw).trim());
  } catch {
    return { ok: false, error: "Paste a full YouTube link, starting with https://" };
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "instagram.com" || host === "instagr.am") {
    return {
      ok: false,
      error: "Instagram links open the Instagram app instead of playing here. Download the reel and upload the video, or post it as a YouTube Short and paste that link.",
    };
  }

  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    const id =
      host === "youtu.be"
        ? parts[0]
        : parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live"
          ? parts[1]
          : u.searchParams.get("v") ?? undefined;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return { ok: false, error: "That YouTube link has no video in it." };
    return { ok: true, link: { kind: "youtube", id } };
  }

  return { ok: false, error: "Only YouTube (Shorts or video) links can be played here. For other clips, upload the video." };
}

/** iframe src that plays the video inside our viewer (privacy-enhanced domain, loops like a reel). */
export function reelEmbedSrc(l: ReelLink): string {
  return `https://www.youtube-nocookie.com/embed/${l.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${l.id}`;
}

/** YouTube's public thumbnail. */
export function reelLinkPoster(l: ReelLink): string {
  return `https://i.ytimg.com/vi/${l.id}/hqdefault.jpg`;
}

/** Canonical link to the video on YouTube. */
export function reelLinkHref(l: ReelLink): string {
  return `https://www.youtube.com/shorts/${l.id}`;
}
