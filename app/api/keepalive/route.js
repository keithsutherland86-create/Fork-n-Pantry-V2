// Keeps the Supabase project out of auto-pause.
//
// Free-tier Supabase projects are paused after 7 days with no database activity. Pausing is
// silent for us (the PWA works offline on local storage) right up until someone opens a
// shared cookbook and every sync call starts failing. This endpoint makes one tiny, real
// query against Postgres so the project always looks active.
//
// It is called on a schedule from two places, either of which is enough on its own:
//   1. Vercel Cron  — see vercel.json (daily, zero setup)
//   2. GitHub Actions — see .github/workflows/supabase-keepalive.yml (every 3 days, backup)
//
// Safe to hit by hand too: https://<your-app>/api/keepalive
//
// Optional lock: set KEEPALIVE_SECRET in Vercel and callers must pass it as
// `Authorization: Bearer <secret>` or `?key=<secret>`. Left unset, the endpoint is open —
// it leaks nothing and does one `limit 1` read, so that is a reasonable default.

export const dynamic = "force-dynamic";

export async function GET(req) {
  const secret = process.env.KEEPALIVE_SECRET || process.env.CRON_SECRET;
  if (secret) {
    const { searchParams } = new URL(req.url);
    const sent = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || searchParams.get("key");
    if (sent !== secret) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service role bypasses RLS so the query definitely reaches the table; the anon key works
  // fine as a fallback (RLS just returns an empty set — still a real round trip to Postgres).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false, reason: "supabase-not-configured" }, { status: 503 });

  const startedAt = Date.now();
  try {
    const res = await fetch(`${url}/rest/v1/shared_cookbooks?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    // Read the body so the query is fully executed, not just started.
    await res.text();
    if (!res.ok) return Response.json({ ok: false, reason: `supabase-${res.status}` }, { status: 502 });
    return Response.json({ ok: true, ms: Date.now() - startedAt, at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e?.name || e).slice(0, 80) }, { status: 502 });
  }
}
