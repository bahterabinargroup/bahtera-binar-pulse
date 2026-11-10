"use server";

import { cekInput, type Hasil, type RawInput } from "@/lib/budget";
import { hitungBudget } from "@/lib/budget-hitung";
import { canUseBudget } from "@/lib/menu";
import { getCurrentUser } from "@/lib/profile";

// Hitungan dijalankan di server (rumus fase push/steady tidak dikirim ke browser).
export async function hitungPengajuan(raw: RawInput): Promise<{ ok: true; hasil: Hasil } | { ok: false }> {
  const { profile } = await getCurrentUser();
  if (!profile || !canUseBudget(profile.role, profile.position?.code)) return { ok: false };
  const c = cekInput(raw);
  if (!c.core) return { ok: false };
  const level = c.locked ? "none" : raw.level;
  return { ok: true, hasil: hitungBudget(c.core, level, raw.toko) };
}
