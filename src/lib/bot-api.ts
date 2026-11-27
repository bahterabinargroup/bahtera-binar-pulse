// API tarikan untuk bot (/api/bot/v1): BACA-SAJA.
// Kunci bot diperiksa DI DATABASE oleh fungsi bot_* (security definer): hash SHA-256, batas laju, log audit,
// dan hanya kolom yang diizinkan yang dikembalikan. Di sini hanya: ambil kunci dari header, teruskan filter,
// dan ubah kode error database menjadi kode HTTP. Tidak memakai kunci admin dan tidak memakai sesi login.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/supabase/env";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export function botJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function botError(status: number, message: string) {
  return botJson({ error: message }, status);
}

// "Authorization: Bearer <kunci>" -> kunci, atau null.
export function bearerKey(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parameter tanggal: kosong = null (database memakai 7 hari terakhir), format salah = error 400.
export function dateParam(url: URL, name: string): string | null | Error {
  const v = url.searchParams.get(name);
  if (v === null || v === "") return null;
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return new Error(`${name} harus berformat YYYY-MM-DD.`);
  return v;
}

export function intParam(url: URL, name: string): number | null | Error {
  const v = url.searchParams.get(name);
  if (v === null || v === "") return null;
  if (!/^\d{1,4}$/.test(v)) return new Error(`${name} harus angka.`);
  return Number(v);
}

export function textParam(url: URL, name: string, max = 100): string | null {
  const v = url.searchParams.get(name);
  if (v === null || v.trim() === "") return null;
  return v.trim().slice(0, max);
}

const STATUS_BY_CODE: Record<string, number> = {
  "28000": 401, // kunci tidak ada / salah / dicabut
  P0429: 429, // batas laju
  "22023": 400, // parameter tidak valid
  "22007": 400,
  "22008": 400,
  "22P02": 400,
};

// Panggil fungsi bot_* di database dengan kunci dari header.
export async function callBot(request: Request, fn: string, args: Record<string, unknown>) {
  const key = bearerKey(request);
  if (!key) return botError(401, "Kunci API tidak ada. Kirim header Authorization: Bearer <kunci>.");

  const env = requireSupabaseEnv();
  const sb = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc(fn, { p_key: key, ...args });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ""] ?? 500;
    if (status === 401) return botError(401, "Kunci API tidak valid atau sudah dicabut.");
    if (status === 500) {
      console.error(`API bot ${fn} gagal: ${error.code ?? "?"}`);
      return botError(500, "Terjadi kesalahan di server.");
    }
    return botError(status, error.message);
  }
  return botJson(data);
}

// Parameter umum: from, to, company, cursor, limit. Mengembalikan Response 400 bila ada yang salah.
export function commonParams(url: URL): Record<string, unknown> | Response {
  const from = dateParam(url, "from");
  const to = dateParam(url, "to");
  const limit = intParam(url, "limit");
  for (const v of [from, to, limit]) if (v instanceof Error) return botError(400, v.message);
  return {
    p_from: from,
    p_to: to,
    p_company: textParam(url, "company", 50),
    p_cursor: textParam(url, "cursor", 80),
    p_limit: limit,
  };
}
