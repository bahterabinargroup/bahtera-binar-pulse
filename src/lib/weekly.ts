import { createClient } from "@/lib/supabase/server";

export type WeeklyRow = {
  week_start: string;
  report_date: string;
  company_code: string;
  company_name: string;
  employee_code: string | null;
  full_name: string;
  position_code: string | null;
  position_name: string | null;
  activities: unknown;
  performance_metrics: unknown;
  obstacles: string | null;
  insights: string | null;
  next_plan: string | null;
  evidence_links: string[];
  updated_at: string;
};

// Laporan satu minggu (Senin–Minggu) lewat RPC get_weekly_team_reports (RLS berlaku).
export async function loadWeekly(weekStart: string, companyId: string | null): Promise<WeeklyRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_weekly_team_reports", {
    p_week_start: weekStart,
    p_company_id: companyId,
  });
  if (error) throw new Error(`Gagal memuat tarikan mingguan: ${error.message}`);
  return (data ?? []) as WeeklyRow[];
}

// Laporan dalam rentang tanggal (mis. satu bulan) langsung dari view v_weekly_team_reports (RLS pemanggil berlaku).
// Dibaca per halaman 1000 baris agar tidak terpotong batas baris server.
export async function loadRange(start: string, end: string, companyId: string | null): Promise<WeeklyRow[]> {
  const supabase = await createClient();
  const out: WeeklyRow[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 50000; from += PAGE) {
    let q = supabase
      .from("v_weekly_team_reports")
      .select("week_start, report_date, company_code, company_name, employee_code, full_name, position_code, position_name, activities, performance_metrics, obstacles, insights, next_plan, evidence_links, updated_at")
      .gte("report_date", start)
      .lte("report_date", end);
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q
      .order("company_name")
      .order("position_sort", { nullsFirst: false })
      .order("full_name")
      .order("report_date")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Gagal memuat tarikan bulanan: ${error.message}`);
    out.push(...((data ?? []) as WeeklyRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

// Bulan "YYYY-MM" -> tanggal pertama & terakhir.
export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const monthLabel = (ym: string) => `${BULAN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const isMonth = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

const CSV_COLUMNS: (keyof WeeklyRow)[] = [
  "week_start",
  "report_date",
  "company_code",
  "company_name",
  "employee_code",
  "full_name",
  "position_code",
  "position_name",
  "activities",
  "performance_metrics",
  "insights",
  "obstacles",
  "next_plan",
  "evidence_links",
  "updated_at",
];

// CSV (pemisah koma, UTF-8 dengan BOM agar terbaca benar di Excel).
// Kolom JSON (aktivitas, metrik) disimpan sebagai teks JSON di satu sel.
export function toCsv(rows: WeeklyRow[]): string {
  const cell = (v: unknown) => {
    const s =
      v === null || v === undefined ? "" : Array.isArray(v) && v.every((x) => typeof x === "string") ? v.join(" ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.join(","), ...rows.map((r) => CSV_COLUMNS.map((c) => cell(r[c])).join(","))];
  return "﻿" + lines.join("\r\n");
}
