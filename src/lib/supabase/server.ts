import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "./env";

// Client Supabase untuk Server Components, Server Functions, dan Route Handlers.
// Memakai sesi login pengguna dari cookie, sehingga RLS berlaku penuh.
export async function createClient() {
  const { url, key } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Dipanggil dari Server Component (tidak boleh menulis cookie).
          // Aman diabaikan; penyegaran sesi ditangani di proxy (M1).
        }
      },
    },
  });
}
