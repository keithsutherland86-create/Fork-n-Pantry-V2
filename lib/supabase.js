import { createClient } from "@supabase/supabase-js";

// Lazy singleton — only initialised in the browser, never during SSR/prerender
let _client = null;
export function getSupabase() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}
