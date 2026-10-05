import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

// Client Supabase untuk komponen yang berjalan di browser ("use client").
export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient(url, key);
}
