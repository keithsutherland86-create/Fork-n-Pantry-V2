// Diagnostic: reports which server-side env vars are DETECTED (booleans only — never the
// values themselves, so this is safe to call from the client). Used by Settings to confirm
// the import/hosting keys are wired up in Vercel.
export async function GET() {
  return Response.json({
    anthropic:          !!process.env.ANTHROPIC_API_KEY,
    apify:              !!process.env.APIFY_TOKEN,
    supabaseUrl:        !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnon:       !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    microlink:          !!process.env.MICROLINK_API_KEY,
    unsplash:           !!process.env.UNSPLASH_ACCESS_KEY,
  });
}
