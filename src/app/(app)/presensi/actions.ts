"use server";

import { revalidatePath } from "next/cache";
import { todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import { isPresensiStatus, noteRequired } from "@/lib/presensi";
import { createClient } from "@/lib/supabase/server";

export type PresensiResult = { ok: true } | { ok: false; error: string };

export type CheckInInput = {
  status: string;
  note: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  photoPath: string | null;
};

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Anda sudah Check-In hari ini.";
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "Akses ditolak. Check-In hanya untuk diri sendiri dan hari ini.";
  if (error.code === "23514") return "Isian tidak memenuhi aturan (catatan wajib untuk Tugas Luar, Izin, atau Sakit).";
  if (error.code === "42P01") return "Tabel presensi belum dibuat. Jalankan supabase/008_presensi.sql.";
  return `Gagal menyimpan: ${error.message}`;
}

// Check-In: nama, company, jabatan, tanggal, dan jam masuk TIDAK dikirim dari form; diisi akun login dan server.
export async function checkIn(input: CheckInInput): Promise<PresensiResult> {
  const { profile } = await getCurrentUser();
  if (!profile?.company) return { ok: false, error: "Akun Anda belum terdaftar. Hubungi admin." };

  if (!isPresensiStatus(input.status)) return { ok: false, error: "Pilih status kehadiran." };
  const note = input.note.trim();
  if (noteRequired(input.status) && !note) return { ok: false, error: "Alasan / catatan wajib diisi untuk status ini." };
  if (note.length > 1000) return { ok: false, error: "Catatan terlalu panjang (maksimal 1000 huruf)." };

  const hasGps = input.lat !== null && input.lng !== null && Number.isFinite(input.lat) && Number.isFinite(input.lng);
  // Foto harus berada di folder milik sendiri (aturan Storage juga menjaganya).
  const photoOk = input.photoPath === null || input.photoPath.startsWith(`${profile.company.id}/${profile.id}/`);
  if (!photoOk) return { ok: false, error: "Foto tidak valid. Pilih ulang fotonya." };

  const supabase = await createClient();
  const { error } = await supabase.from("presensi").insert({
    company_id: profile.company.id,
    user_id: profile.id,
    status: input.status,
    note: note || null,
    check_in_lat: hasGps ? Number(input.lat!.toFixed(6)) : null,
    check_in_lng: hasGps ? Number(input.lng!.toFixed(6)) : null,
    check_in_accuracy_m: hasGps && input.accuracy !== null && Number.isFinite(input.accuracy) ? Math.round(input.accuracy) : null,
    check_in_photo_path: input.photoPath,
  });
  if (error) return { ok: false, error: dbError(error) };

  revalidatePath("/presensi");
  revalidatePath("/");
  return { ok: true };
}

export type CheckOutInput = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  photoPath: string;
};

// Check-Out: hanya setelah Check-In hari ini, sekali saja, foto wajib. Jam pulang diisi server.
export async function checkOut(input: CheckOutInput): Promise<PresensiResult> {
  const { profile } = await getCurrentUser();
  if (!profile?.company) return { ok: false, error: "Akun Anda belum terdaftar. Hubungi admin." };
  if (!input.photoPath || !input.photoPath.startsWith(`${profile.company.id}/${profile.id}/`)) {
    return { ok: false, error: "Foto selfie / bukti pulang wajib diisi." };
  }

  const hasGps = input.lat !== null && input.lng !== null && Number.isFinite(input.lat) && Number.isFinite(input.lng);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("presensi")
    .update({
      check_out_lat: hasGps ? Number(input.lat!.toFixed(6)) : null,
      check_out_lng: hasGps ? Number(input.lng!.toFixed(6)) : null,
      check_out_accuracy_m: hasGps && input.accuracy !== null && Number.isFinite(input.accuracy) ? Math.round(input.accuracy) : null,
      check_out_photo_path: input.photoPath,
    })
    .eq("user_id", profile.id)
    .eq("attendance_date", todayJakarta())
    .select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data || data.length === 0) return { ok: false, error: "Check-Out belum bisa: Anda belum Check-In hari ini, atau sudah Check-Out." };

  revalidatePath("/presensi");
  revalidatePath("/");
  return { ok: true };
}
