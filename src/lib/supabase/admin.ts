import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

// Client ADMIN (melewati RLS). HANYA untuk server dan HANYA dipanggil setelah
// memastikan pemanggilnya Owner (lihat requireOwnerAction). Dipakai untuk
// mengirim email undangan lewat Supabase Auth Admin API.
// "server-only" membuat build gagal bila file ini terbawa ke kode browser.
export function createAdminClient() {
  const env = getSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secret) return null;
  return createClient(env.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
