"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerAction } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type CreateKeyResult = { ok: true; key: string } | { ok: false; error: string };
export type RevokeResult = { ok: true } | { ok: false; error: string };

const NOT_READY = "Fitur belum aktif. Jalankan supabase/025_api_bot.sql.";

// Membuat kunci API bot. Kunci asli hanya dikembalikan SEKALI ke layar Owner; database menyimpan hash-nya saja.
export async function createBotKey(name: string): Promise<CreateKeyResult> {
  if (!(await requireOwnerAction())) return { ok: false, error: "Hanya Owner." };
  const n = String(name ?? "").trim();
  if (!n) return { ok: false, error: "Nama kunci wajib diisi, misalnya \"Rakazo\"." };
  if (n.length > 60) return { ok: false, error: "Nama kunci maksimal 60 karakter." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_api_key", { p_name: n });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return { ok: false, error: NOT_READY };
    if (error.code === "42501") return { ok: false, error: "Hanya Owner." };
    return { ok: false, error: "Gagal membuat kunci." };
  }
  revalidatePath("/owner/api-bot");
  return { ok: true, key: String(data) };
}

// Mencabut kunci: langsung tidak bisa dipakai lagi (tanpa deploy ulang).
export async function revokeBotKey(id: string): Promise<RevokeResult> {
  if (!(await requireOwnerAction())) return { ok: false, error: "Hanya Owner." };
  if (!isUuid(id)) return { ok: false, error: "Kunci tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_api_key", { p_id: id });
  if (error) return { ok: false, error: error.code === "P0002" ? "Kunci tidak ditemukan." : "Gagal mencabut kunci." };
  revalidatePath("/owner/api-bot");
  return { ok: true };
}
