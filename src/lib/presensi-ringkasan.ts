// Ringkasan presensi per karyawan untuk satu bulan: jam masuk/pulang rata-rata, lama di kantor, dan hitungan status.
// Hanya membaca (tanpa mengubah database); data disaring RLS.
import { todayJakarta } from "@/lib/date";
import { leaveDaysIn } from "@/lib/leave";
import type { Profile } from "@/lib/profile";
import { leadPositionIds } from "@/lib/profile";
import type { createClient } from "@/lib/supabase/server";
import { monthEnd } from "@/lib/target";
import { isUuid } from "@/lib/uuid";

type Sb = Awaited<ReturnType<typeof createClient>>;
const PAGE = 1000;

export type PresRow = { user_id: string; attendance_date: string; status: string; check_in_at: string; check_out_at: string | null };
type LeaveRow = { user_id: string; kind: string; start_date: string; end_date: string };
export type Person = { id: string; full_name: string; company_id: string; created_at: string; position: { name: string } | null };

export type Ringkasan = {
  person: Person;
  hadir: number; // hari WFO + Tugas Luar
  wfo: number;
  tugasLuar: number;
  izin: number; // hari: Izin lewat presensi + izin disetujui
  sakit: number;
  cuti: number; // hari cuti disetujui
  belumPulang: number; // hari WFO/Tugas Luar tanpa Check-Out
  avgMasukMenit: number | null; // rata-rata jam Check-In (menit sejak 00.00 WIB), WFO + Tugas Luar
  avgPulangMenit: number | null;
  kantorMenit: number; // total lama di kantor (WFO yang sudah Check-Out)
  kantorHari: number; // jumlah hari WFO yang punya durasi
};

// WIB tidak memakai waktu musim panas, jadi selalu UTC+7.
const menitWib = (iso: string) => (Math.floor(new Date(iso).getTime() / 60000) + 7 * 60) % 1440;
const rata = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function summarize(person: Person, rows: PresRow[], leaves: LeaveRow[], from: string, to: string): Ringkasan {
  const r: Ringkasan = { person, hadir: 0, wfo: 0, tugasLuar: 0, izin: 0, sakit: 0, cuti: 0, belumPulang: 0, avgMasukMenit: null, avgPulangMenit: null, kantorMenit: 0, kantorHari: 0 };
  const masuk: number[] = [];
  const pulang: number[] = [];
  const adaPresensi = new Set(rows.map((x) => x.attendance_date));
  for (const x of rows) {
    if (x.status === "wfo" || x.status === "tugas_luar") {
      r.hadir++;
      if (x.status === "wfo") r.wfo++;
      else r.tugasLuar++;
      masuk.push(menitWib(x.check_in_at));
      if (x.check_out_at) {
        pulang.push(menitWib(x.check_out_at));
        if (x.status === "wfo") {
          r.kantorMenit += Math.max(0, Math.round((new Date(x.check_out_at).getTime() - new Date(x.check_in_at).getTime()) / 60000));
          r.kantorHari++;
        }
      } else if (x.attendance_date < todayJakarta()) {
        r.belumPulang++; // hari ini belum dihitung (masih bisa Check-Out)
      }
    } else if (x.status === "izin") r.izin++;
    else if (x.status === "sakit") r.sakit++;
  }
  // Cuti/izin disetujui pada hari yang tidak punya presensi (tidak dihitung ganda).
  for (const l of leaves) {
    for (const day of leaveDaysIn(l, from, to)) {
      if (adaPresensi.has(day)) continue;
      if (l.kind === "cuti") r.cuti++;
      else r.izin++;
    }
  }
  r.avgMasukMenit = rata(masuk);
  r.avgPulangMenit = rata(pulang);
  return r;
}

export const fmtMenitJam = (m: number | null) => (m === null ? "—" : `${String(Math.floor(m / 60)).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}`);
export const fmtDurasi = (m: number) => (m <= 0 ? "—" : `${Math.floor(m / 60)} j ${String(m % 60).padStart(2, "0")} m`);

export type Loaded = { list: Ringkasan[]; from: string; to: string; tableMissing: boolean };

// company: kosong = semua company yang boleh dilihat (Owner); Manager dan Lead tetap dibatasi RLS.
export async function loadRingkasan(sb: Sb, profile: Profile, month: string, company: string): Promise<Loaded> {
  const from = month;
  const end = monthEnd(month);
  const today = todayJakarta();
  const to = end < today ? end : today;
  const companyId = profile.role === "owner" && isUuid(company) ? company : "";

  const rows: (PresRow & { user_id: string })[] = [];
  for (let start = 0; ; start += PAGE) {
    let q = sb
      .from("presensi")
      .select("user_id, attendance_date, status, check_in_at, check_out_at")
      .gte("attendance_date", from)
      .lte("attendance_date", end)
      .order("attendance_date")
      .order("user_id")
      .range(start, start + PAGE - 1);
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q;
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return { list: [], from, to, tableMissing: true };
      throw new Error(`Gagal memuat presensi: ${error.message}`);
    }
    rows.push(...((data ?? []) as PresRow[]));
    if (!data || data.length < PAGE) break;
  }

  let leaveQ = sb.from("leave_requests").select("user_id, kind, start_date, end_date").eq("status", "approved").lte("start_date", end).gte("end_date", from).limit(5000);
  let peopleQ = sb.from("users").select("id, full_name, company_id, created_at, position:roles_config(name)").eq("is_active", true).order("full_name").limit(2000);
  // Lead hanya karyawan biasa di divisinya (dan divisi tambahannya); pengelola melihat karyawan, Lead, dan manager.
  peopleQ = profile.role === "lead" ? peopleQ.eq("role", "employee").in("position_id", leadPositionIds(profile)) : peopleQ.in("role", ["employee", "lead", "manager"]);
  if (companyId) {
    leaveQ = leaveQ.eq("company_id", companyId);
    peopleQ = peopleQ.eq("company_id", companyId);
  }
  const [leaveRes, peopleRes] = await Promise.all([leaveQ, peopleQ]);
  if (peopleRes.error) throw new Error(`Gagal memuat pengguna: ${peopleRes.error.message}`);
  const people = (peopleRes.data ?? []) as unknown as Person[];
  const leaves = (leaveRes.error ? [] : (leaveRes.data ?? [])) as (LeaveRow & { user_id: string })[];

  const byUserRows = new Map<string, PresRow[]>();
  for (const r of rows) byUserRows.set(r.user_id, [...(byUserRows.get(r.user_id) ?? []), r]);
  const byUserLeaves = new Map<string, LeaveRow[]>();
  for (const l of leaves) byUserLeaves.set(l.user_id, [...(byUserLeaves.get(l.user_id) ?? []), l]);

  const list = people.map((p) => summarize(p, byUserRows.get(p.id) ?? [], byUserLeaves.get(p.id) ?? [], from, to));
  return { list, from, to, tableMissing: false };
}
