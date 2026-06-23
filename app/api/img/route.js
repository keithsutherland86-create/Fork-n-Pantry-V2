export const runtime = "edge";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url || !url.startsWith("http")) {
    return new Response("Bad request", { status: 400 });
  }

  let origin;
  try { origin = new URL(url).origin; } catch { return new Response("Bad URL", { status: 400 }); }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "image/webp,image/avif,image/jpeg,image/png,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": origin + "/",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return new Response("Upstream error", { status: res.status });

    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return new Response("Not an image", { status: 400 });

    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Proxy error", { status: 502 });
  }
}
