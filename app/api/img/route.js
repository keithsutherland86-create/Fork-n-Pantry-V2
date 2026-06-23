export async function GET(req) {
  const { searchParams } = new URL(req.url);
  let url = searchParams.get("url");

  if (!url || !url.startsWith("http")) {
    return new Response("Bad request", { status: 400 });
  }

  // Decode HTML entities that can appear in JSON-LD image URLs
  url = url.replace(/&amp;/g, "&").replace(/&#38;/g, "&").replace(/&quot;/g, '"');

  let origin;
  try { origin = new URL(url).origin; } catch { return new Response("Bad URL", { status: 400 }); }

  const controllers = [new AbortController(), new AbortController()];
  const timeout = setTimeout(() => controllers.forEach(c => c.abort()), 9000);

  // Try twice: once with a browser UA, once with Googlebot (some CDNs block mobile UA)
  const attempts = [
    {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Referer": origin + "/",
    },
    {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Referer": origin + "/",
    },
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          ...attempts[i],
          "Accept": "image/webp,image/avif,image/jpeg,image/png,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controllers[i].signal,
      });

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) continue;

      const buffer = await res.arrayBuffer();
      clearTimeout(timeout);
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {}
  }

  clearTimeout(timeout);
  return new Response("Proxy error", { status: 502 });
}
