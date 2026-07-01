// Dedicated social scraper (Apify) — the robust path for Instagram/TikTok, which block
// anonymous access. Inert unless APIFY_TOKEN is set, so the app runs unchanged without a key.
// Actor IDs are overridable via env vars; defaults are the popular maintained actors.
//   APIFY_TOKEN        — your Apify API token (required to enable this path)
//   APIFY_IG_ACTOR     — Instagram actor id (default apify~instagram-scraper)
//   APIFY_TIKTOK_ACTOR — TikTok actor id   (default clockworks~tiktok-scraper)
export async function fetchViaApify(url, isInstagram, isTikTok) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  let actor, input;
  if (isInstagram) {
    actor = process.env.APIFY_IG_ACTOR || "apify~instagram-scraper";
    input = { directUrls: [url], resultsType: "posts", resultsLimit: 1, addParentData: false };
  } else if (isTikTok) {
    actor = process.env.APIFY_TIKTOK_ACTOR || "clockworks~tiktok-scraper";
    input = { postURLs: [url], resultsPerPage: 1, shouldDownloadVideos: false, shouldDownloadCovers: false };
  } else return null;
  try {
    // run-sync-get-dataset-items runs the actor and returns its output rows in one call
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=60`,
      { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(50000) }
    );
    if (!res.ok) { console.error("Apify error:", res.status, await res.text().catch(()=>"" )); return null; }
    const items = await res.json();
    const it = Array.isArray(items) ? items[0] : null;
    if (!it) return null;
    // Normalise field names across the two actors
    const caption = it.caption || it.text || it.description || "";
    const image =
      it.displayUrl || it.imageUrl ||
      it.videoMeta?.coverUrl || it.videoMeta?.originalCoverUrl ||
      (Array.isArray(it.covers) ? it.covers[0] : "") ||
      (Array.isArray(it.images) ? it.images[0] : "") || "";
    const title = it.ownerFullName || it.ownerUsername || it.authorMeta?.name || it.authorMeta?.nickName || "";
    return { caption, image, title };
  } catch (e) { console.error("Apify fetch failed:", e?.message); return null; }
}
