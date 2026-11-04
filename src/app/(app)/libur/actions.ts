"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Tanggal itu sudah ada di daftar hari libur.";
  if (error.code === "23514") return "Nama hari libur wajib diisi (maks. 100 huruf).";
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "Hanya Owner yang bisa mengelola hari libur.";
  if (error.code === "42P01" || error.code === "PGRST205") return "Tabel hari libur belum dibuat. Jalankan supabase/019_hari_libur.sql di Supabase SQL Editor.";
  return `Gagal menyimpan: ${error.message}`;
}

// Owner saja. Database (RLS) tetap penentu akhir.
export async function addHoliday(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role !== "owner") return { ok: false, error: "Hanya Owner yang bisa mengelola hari libur." };
  const date = String(f.get("holiday_date") ?? "").trim();
  const name = String(f.get("name") ?? "").trim();
  if (!YMD.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: "Pilih tanggal yang valid." };
  if (!name) return { ok: false, error: "Nama hari libur wajib diisi, mis. Hari Raya Idul Fitri." };
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert({ holiday_date: date, name });
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/libur");
  revalidatePath("/presensi/ringkasan");
  return { ok: true, message: "Hari libur ditambahkan." };
}

export async function deleteHoliday(date: string): Promise<ActionResult> {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role !== "owner") return { ok: false, error: "Hanya Owner yang bisa mengelola hari libur." };
  if (!YMD.test(date)) return { ok: false, error: "Tanggal tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("holidays").delete().eq("holiday_date", date).select("holiday_date");
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: "Hari libur tidak ditemukan." };
  revalidatePath("/libur");
  revalidatePath("/presensi/ringkasan");
  return { ok: true, message: "Hari libur dihapus." };
}
