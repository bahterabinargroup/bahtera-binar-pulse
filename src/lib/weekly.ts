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
