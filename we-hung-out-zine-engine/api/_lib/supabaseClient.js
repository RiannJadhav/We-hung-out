import { createClient } from "@supabase/supabase-js";

// Same project URL + anon key used in web/index.html. The anon key is
// meant to be public (Supabase's own design) -- what actually protects
// the data is the RLS policies on each table/bucket, not keeping this
// key secret. No Vercel environment variables are required for this.
const SUPABASE_URL = "https://orrxslxansacwqfuxqco.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycnhzbHhhbnNhY3dxZnV4cWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MzU2NTMsImV4cCI6MjEwNjUxMTY1M30.dGnBt44uWt4YpK6DEhj29vfW4hvRF8hsxag22oXgLfU";

export function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
