"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Pesan dari database sudah berbahasa Indonesia untuk aturan bisnis (kode 22023, P0002, 23505 dari pemicu).
function dbError(error: { code?: string; message: string }): string {
  if (error.code === "42P01" || error.code === "PGRST202") return "Fitur cuti/izin belum aktif di database. Jalankan supabase/011 dan 012.";
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) return error.message.startsWith("Tidak boleh") ? error.message : "Akses ditolak.";
  if (error.code === "23514") {
    if (/reason_ok/.test(error.message)) return "Alasan wajib diisi (maksimal 1000 huruf).";
    if (/dates_ok/.test(error.message)) return "Tanggal selesai harus sama atau setelah tanggal mulai, dan maksimal 90 hari.";
    return error.message.startsWith("Tanggal") ? error.message : "Isian tidak memenuhi aturan.";
  }
  if (["22023", "P0002", "23505"].includes(error.code ?? "")) return error.message;
  return `Gagal: ${error.message}`;
}

function refresh() {
  revalidatePath("/cuti");
  revalidatePath("/cuti/persetujuan");
  revalidatePath("/presensi");
  revalidatePath("/");
}

export async function submitLeave(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const { profile } = await getCurrentUser();
  if (!profile?.company) return { ok: false, error: "Akun Anda belum terdaftar. Hubungi admin." };
  if (profile.role === "owner") return { ok: false, error: "Owner tidak perlu mengajukan cuti atau izin." };

  const kind = str(f, "kind");
  const start = str(f, "start_date");
  const end = str(f, "end_date") || start;
  const reason = str(f, "reason");
  if (kind !== "cuti" && kind !== "izin") return { ok: false, error: "Pilih jenis: Cuti atau Izin." };
  if (!YMD.test(start) || !YMD.test(end)) return { ok: false, error: "Isi tanggal mulai dan tanggal selesai." };
  if (end < start) return { ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  if (!reason) return { ok: false, error: "Alasan wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .insert({ company_id: profile.company.id, user_id: profile.id, kind, start_date: start, end_date: end, reason });
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true, message: "Pengajuan terkirim. Menunggu keputusan." };
}

export async function cancelLeave(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  if (!isUuid(id)) return { ok: false, error: "Pengajuan tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_leave", { p_id: id });
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true, message: "Pengajuan dibatalkan." };
}

export async function requestLeaveCancel(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const reason = str(f, "reason");
  if (!isUuid(id)) return { ok: false, error: "Pengajuan tidak valid." };
  if (!reason) return { ok: false, error: "Tulis alasan pembatalan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_leave_cancel", { p_id: id, p_reason: reason });
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true, message: "Pengajuan pembatalan terkirim." };
}

export async function decideLeave(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  if (!isUuid(id)) return { ok: false, error: "Pengajuan tidak valid." };
  const approve = str(f, "decision") === "approve";
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_leave", { p_id: id, p_approve: approve, p_note: str(f, "note") || null });
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true, message: approve ? "Pengajuan disetujui." : "Pengajuan ditolak." };
}

export async function decideLeaveCancel(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  if (!isUuid(id)) return { ok: false, error: "Pengajuan tidak valid." };
  const approve = str(f, "decision") === "approve";
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_leave_cancel", { p_id: id, p_approve: approve, p_note: str(f, "note") || null });
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true, message: approve ? "Pembatalan disetujui." : "Pembatalan ditolak, cuti tetap berlaku." };
}
