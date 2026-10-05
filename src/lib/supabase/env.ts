// Membaca alamat & kunci publik Supabase dari .env.local.
// Hanya kunci publik (publishable/anon) yang boleh dipakai di aplikasi ini;
// keamanan data ditegakkan oleh RLS di database.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi di .env.local",
    );
  }
  return env;
}
