import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

// Client Supabase untuk komponen yang berjalan di browser ("use client").
// detectSessionInUrl dimatikan: tautan email ditangani sendiri oleh
// /auth/confirm (PKCE) dan EmailLinkHandler (tautan undangan bawaan Supabase).
export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient(url, key, { auth: { detectSessionInUrl: false } });
}
