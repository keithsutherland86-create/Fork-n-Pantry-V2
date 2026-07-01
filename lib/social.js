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
    // Normalise field names across the two actors + their variants (posts, reels, carousels)
    const caption = it.caption || it.text || it.description || "";
    const imgFromArr = a => Array.isArray(a) && a.length ? (typeof a[0] === "string" ? a[0] : (a[0]?.url || a[0]?.displayUrl || a[0]?.coverUrl || "")) : "";
    const image =
      it.displayUrl || it.imageUrl || it.thumbnailUrl || it.thumbnailSrc || it.image ||
      it.videoMeta?.coverUrl || it.videoMeta?.originalCoverUrl ||
      imgFromArr(it.covers) || imgFromArr(it.images) || imgFromArr(it.childPosts) ||
      (Array.isArray(it.videoVersions) ? "" : "") || "";
    const title = it.ownerFullName || it.ownerUsername || it.authorMeta?.name || it.authorMeta?.nickName || "";
    // Diagnostics for the no-image case: expose Apify's own error + the item's field names
    const err = it.error || it.errorDescription || "";
    const keys = Object.keys(it).slice(0, 30).join(",");
    return { caption, image, title, _err: err, _keys: keys };
  } catch (e) { console.error("Apify fetch failed:", e?.message); return null; }
}
