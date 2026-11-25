"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Isi tanggal mulai kerja (reset kuota cuti/izin). Owner semua; Manager hanya karyawan dan Lead di company-nya.
// Aturan sebenarnya dijaga fungsi database set_work_start_date (supabase/024).
export async function setWorkStart(id: string, date: string | null): Promise<ActionResult> {
  const { profile } = await getCurrentUser();
  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) return { ok: false, error: "Hanya Owner dan Manager yang bisa mengisi tanggal mulai kerja." };
  if (!isUuid(id)) return { ok: false, error: "Pengguna tidak valid." };
  const d = date ? String(date) : null;
  if (d !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)))) return { ok: false, error: "Tanggal tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_work_start_date", { p_user: id, p_date: d });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "Anda hanya bisa mengisi tanggal untuk karyawan dan Lead di company Anda." };
    if (error.code === "PGRST202" || error.code === "42883") return { ok: false, error: "Fitur belum aktif. Jalankan supabase/024_kedaluwarsa_dan_mulai_kerja_manager.sql." };
    if (error.code === "22023") return { ok: false, error: "Tanggal mulai kerja tidak valid." };
    return { ok: false, error: `Gagal menyimpan: ${error.message}` };
  }
  revalidatePath("/mulai-kerja");
  revalidatePath("/owner/pengguna");
  return { ok: true, message: "Tanggal mulai kerja disimpan." };
}
