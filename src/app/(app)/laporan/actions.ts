"use server";

import { revalidatePath } from "next/cache";
import { todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ReportData } from "@/lib/report/form-state";

export type SaveResult =
  | { ok: true; reportId: string; savedAt: string }
  | { ok: false; error: string; locked?: boolean };

const LOCKED = "Hari sudah berganti, laporan ini terkunci. Salin isian Anda bila masih diperlukan.";

// Simpan laporan hari ini. Database (RLS) tetap penentu akhir: laporan
// hanya bisa dibuat/diubah untuk tanggal hari ini (WIB) oleh pemiliknya.
export async function saveReport(input: {
  reportId: string | null;
  reportDate: string; // tanggal saat form dibuka
  data: ReportData;
}): Promise<SaveResult> {
  const { profile } = await getCurrentUser();
  if (!profile) return { ok: false, error: "Sesi Anda sudah berakhir. Silakan masuk lagi." };

  if (input.reportDate !== todayJakarta()) return { ok: false, error: LOCKED, locked: true };

  const supabase = await createClient();
  const fields = {
    activities: input.data.activities,
    performance_metrics: input.data.performance_metrics,
    insights: input.data.insights,
    obstacles: input.data.obstacles,
    next_plan: input.data.next_plan,
    evidence_links: input.data.evidence_links,
  };

  if (input.reportId) {
    const { data, error } = await supabase
      .from("daily_reports")
      .update(fields)
      .eq("id", input.reportId)
      .select("id, updated_at");
    if (error) return { ok: false, error: describe(error) };
    // 0 baris = ditolak RLS (biasanya karena tanggal sudah berganti).
    if (!data?.length) return { ok: false, error: LOCKED, locked: true };
    revalidatePath("/laporan");
    return { ok: true, reportId: data[0].id, savedAt: data[0].updated_at };
  }

  const { data, error } = await supabase
    .from("daily_reports")
    .insert({ ...fields, user_id: profile.id, company_id: profile.company?.id })
    .select("id, updated_at, report_date")
    .single();
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "Laporan hari ini sudah pernah disimpan (mungkin dari tab atau perangkat lain). Satu karyawan hanya boleh punya satu laporan per hari. Salin isian Anda, lalu muat ulang halaman untuk melanjutkan laporan yang sudah ada.",
      };
    }
    return { ok: false, error: describe(error) };
  }
  if (data.report_date !== input.reportDate) {
    // Tanggal berganti tepat di antara pemeriksaan dan penyimpanan.
    return { ok: false, error: LOCKED, locked: true };
  }
  revalidatePath("/laporan");
  return { ok: true, reportId: data.id, savedAt: data.updated_at };
}

function describe(error: { code?: string; message: string }): string {
  if (error.code === "23514" && error.message.includes("evidence"))
    return "Maksimal 20 link bukti.";
  if (error.code === "42501" || /row-level security/i.test(error.message))
    return "Laporan tidak dapat disimpan karena akses ditolak. Pastikan Anda menyimpan laporan milik sendiri untuk hari ini.";
  if (/fetch|network/i.test(error.message))
    return "Tidak dapat terhubung ke server. Periksa koneksi internet, lalu tekan Simpan lagi.";
  return `Laporan gagal disimpan. Coba lagi. (${error.message})`;
}

// Owner: koreksi laporan tanggal berapa pun (RLS daily_reports_owner_all).
export async function correctReport(input: { reportId: string; data: ReportData }): Promise<SaveResult> {
  const { profile } = await getCurrentUser();
  if (profile?.role !== "owner") return { ok: false, error: "Hanya Owner yang bisa mengoreksi laporan lampau." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_reports")
    .update({
      activities: input.data.activities,
      performance_metrics: input.data.performance_metrics,
      insights: input.data.insights,
      obstacles: input.data.obstacles,
      next_plan: input.data.next_plan,
      evidence_links: input.data.evidence_links,
    })
    .eq("id", input.reportId)
    .select("id, updated_at");
  if (error) return { ok: false, error: describe(error) };
  if (!data?.length) return { ok: false, error: "Laporan tidak ditemukan." };
  revalidatePath("/dashboard");
  return { ok: true, reportId: data[0].id, savedAt: data[0].updated_at };
}
