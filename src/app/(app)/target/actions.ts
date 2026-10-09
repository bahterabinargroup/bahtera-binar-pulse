"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { todayJakarta } from "@/lib/date";
import { requireOwnerAction } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { monthStart, parseMonth, parseRupiah, prevMonth } from "@/lib/target";

const NOT_OWNER: ActionResult = { ok: false, error: "Hanya Owner yang bisa menetapkan target." };

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "42P01") return "Tabel target belum dibuat di database. Jalankan supabase/007_target_omzet.sql.";
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "Akses ditolak.";
  if (error.code === "23514") return "Angka target tidak memenuhi aturan (0 sampai 1 triliun).";
  return `Gagal menyimpan: ${error.message}`;
}

// Simpan semua kolom target satu bulan sekaligus: isian kosong = hapus target ADV itu.
export async function saveTargets(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  if (!(await requireOwnerAction())) return NOT_OWNER;
  const month = parseMonth(String(f.get("month") ?? ""), monthStart(todayJakarta()));

  const entries = [...f.entries()]
    .filter(([k]) => k.startsWith("amt_"))
    .map(([k, v]) => ({ userId: k.slice(4), raw: String(v) }));
  if (entries.length === 0) return { ok: false, error: "Tidak ada ADV untuk diisi." };

  const supabase = await createClient();
  const ids = entries.map((e) => e.userId);
  const [usersRes, existingRes] = await Promise.all([
    supabase.from("users").select("id, company_id, full_name").in("id", ids),
    supabase.from("omzet_targets").select("id, user_id").eq("month", month).in("user_id", ids),
  ]);
  if (usersRes.error) return { ok: false, error: dbError(usersRes.error) };
  if (existingRes.error) return { ok: false, error: dbError(existingRes.error) };
  const users = new Map((usersRes.data ?? []).map((u) => [u.id as string, u]));
  const existing = new Map((existingRes.data ?? []).map((r) => [r.user_id as string, r.id as string]));

  // Periksa semua isian dulu; tidak ada yang disimpan jika ada yang salah.
  const parsed: { userId: string; amount: number | null }[] = [];
  for (const e of entries) {
    const u = users.get(e.userId);
    if (!u) return { ok: false, error: "ADV tidak ditemukan. Muat ulang halaman." };
    const amount = parseRupiah(e.raw);
    if (amount !== null && Number.isNaN(amount)) {
      return { ok: false, error: `Target ${u.full_name} tidak valid. Tulis angka saja, contoh: 50.000.000` };
    }
    parsed.push({ userId: e.userId, amount });
  }

  let saved = 0;
  let removed = 0;
  for (const p of parsed) {
    const id = existing.get(p.userId);
    if (p.amount === null) {
      if (id) {
        const { error } = await supabase.from("omzet_targets").delete().eq("id", id);
        if (error) return { ok: false, error: dbError(error) };
        removed++;
      }
    } else if (id) {
      const { error } = await supabase.from("omzet_targets").update({ amount: p.amount }).eq("id", id);
      if (error) return { ok: false, error: dbError(error) };
      saved++;
    } else {
      const { error } = await supabase
        .from("omzet_targets")
        .insert({ company_id: users.get(p.userId)!.company_id, user_id: p.userId, month, amount: p.amount });
      if (error) return { ok: false, error: dbError(error) };
      saved++;
    }
  }
  revalidatePath("/target");
  revalidatePath("/");
  return { ok: true, message: `Target tersimpan untuk ${saved} ADV${removed ? `, ${removed} target dihapus` : ""}.` };
}

// Salin target bulan lalu ke bulan ini untuk ADV yang belum punya target bulan ini.
export async function copyLastMonth(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  if (!(await requireOwnerAction())) return NOT_OWNER;
  const month = parseMonth(String(f.get("month") ?? ""), monthStart(todayJakarta()));
  const supabase = await createClient();
  const [lastRes, nowRes, activeRes] = await Promise.all([
    supabase.from("omzet_targets").select("user_id, company_id, amount").eq("month", prevMonth(month)),
    supabase.from("omzet_targets").select("user_id").eq("month", month),
    supabase.from("users").select("id").eq("is_active", true),
  ]);
  for (const r of [lastRes, nowRes, activeRes]) if (r.error) return { ok: false, error: dbError(r.error) };
  const have = new Set((nowRes.data ?? []).map((r) => r.user_id as string));
  const active = new Set((activeRes.data ?? []).map((r) => r.id as string));
  const rows = (lastRes.data ?? [])
    .filter((r) => !have.has(r.user_id as string) && active.has(r.user_id as string))
    .map((r) => ({ company_id: r.company_id, user_id: r.user_id, month, amount: r.amount }));
  if (rows.length === 0) return { ok: false, error: "Tidak ada target bulan lalu yang perlu disalin." };
  const { error } = await supabase.from("omzet_targets").insert(rows);
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/target");
  revalidatePath("/");
  return { ok: true, message: `${rows.length} target disalin dari bulan lalu.` };
}
