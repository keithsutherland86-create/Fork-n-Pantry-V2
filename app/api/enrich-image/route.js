import { fetchViaApify } from "../../../lib/social";

// Background image upgrade for social imports. Microlink gives a quick low-res thumbnail on
// the initial parse; this endpoint fetches the full-resolution image via Apify and re-hosts
// it to Supabase Storage server-side (browsers can't fetch Instagram CDN URLs — CORS).
// Returns a permanent public URL the client swaps in. Inert unless APIFY_TOKEN + the
// Supabase service role key are set.
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { return Response.json({ ok:false }, { status:400 }); }
  const { url = "", recipeId = "", userId = "" } = body;

  const isInstagram = /instagram\.com\/(p|reel|tv)\//i.test(url);
  const isTikTok = /tiktok\.com\/@[^/]+\/video\//i.test(url);
  if (!url || (!isInstagram && !isTikTok)) return Response.json({ ok:false });

  // 1. High-res image from the dedicated scraper
  const ap = await fetchViaApify(url, isInstagram, isTikTok);
  if (!ap?.image) return Response.json({ ok:false });

  // 2. Re-host it to Supabase Storage so the CDN expiry never breaks the card
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !svcKey) {
    // No storage configured — hand back the raw high-res URL; better than the thumbnail,
    // though it will eventually expire. (Set SUPABASE_SERVICE_ROLE_KEY to make it permanent.)
    return Response.json({ ok:true, image: ap.image, permanent:false });
  }

  try {
    const imgRes = await fetch(ap.image, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) return Response.json({ ok:true, image: ap.image, permanent:false });
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buf = await imgRes.arrayBuffer();
    // Mirror the client's path scheme (userId/recipeId) so there's one image per recipe
    const path = `${userId || "social"}/${recipeId || Date.now()}.${ext}`;
    const up = await fetch(`${sbUrl}/storage/v1/object/recipe-images/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": contentType, "x-upsert": "true" },
      body: buf,
    });
    if (!up.ok) {
      console.error("Supabase upload failed:", up.status, await up.text().catch(()=>"" ));
      return Response.json({ ok:true, image: ap.image, permanent:false });
    }
    const publicUrl = `${sbUrl}/storage/v1/object/public/recipe-images/${path}`;
    return Response.json({ ok:true, image: publicUrl, permanent:true });
  } catch (e) {
    console.error("enrich-image rehost failed:", e?.message);
    return Response.json({ ok:true, image: ap.image, permanent:false });
  }
}
