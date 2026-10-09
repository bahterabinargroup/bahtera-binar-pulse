// Target omzet: hitungan murni (tanpa akses database). Target bulanan ditetapkan Owner per ADV;
// target harian = target bulan ÷ jumlah hari kerja (Senin-Sabtu).

import { addDays } from "@/lib/date";
import { eachDay, isWorkday } from "@/lib/dashboard";

export const monthStart = (ymd: string) => `${ymd.slice(0, 7)}-01`;

export function monthEnd(ymd: string): string {
  const d = new Date(`${monthStart(ymd)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export const nextMonth = (ymd: string) => monthStart(addDays(monthEnd(ymd), 1));
export const prevMonth = (ymd: string) => monthStart(addDays(monthStart(ymd), -1));

export const monthDays = (ymd: string) => eachDay(monthStart(ymd), monthEnd(ymd));
export const workdaysInMonth = (ymd: string) => monthDays(ymd).filter(isWorkday);

export const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const monthLabel = (ymd: string) => `${MONTH_NAMES[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}`;

// Hanya angka bulan yang valid: "2026-10" atau "2026-10-01".
export function parseMonth(v: unknown, fallback: string): string {
  const m = typeof v === "string" ? /^(\d{4})-(0[1-9]|1[0-2])(-01)?$/.exec(v) : null;
  return m ? `${m[1]}-${m[2]}-01` : fallback;
}

export type TargetProgress = {
  monthlyTarget: number;
  dailyTarget: number | null; // null = hari ini bukan hari kerja
  todayActual: number;
  todayPct: number | null;
  mtdActual: number;
  mtdPct: number | null; // % dari target bulanan
  pacePct: number | null; // % target bulan yang seharusnya sudah tercapai hari ini
  workdays: number;
  elapsedWorkdays: number;
  series: { day: string; actual: number | null; target: number }[]; // kumulatif per hari
};

export function targetProgress(monthlyTarget: number, dailyActual: Record<string, number>, today: string): TargetProgress {
  const month = monthStart(today);
  const days = monthDays(month);
  const work = days.filter(isWorkday);
  const perDay = work.length ? monthlyTarget / work.length : 0;

  let cumTarget = 0;
  let cumActual = 0;
  const series = days.map((day) => {
    if (isWorkday(day)) cumTarget += perDay;
    const past = day <= today;
    if (past) cumActual += dailyActual[day] ?? 0;
    return { day, actual: past ? cumActual : null, target: cumTarget };
  });

  const todayActual = dailyActual[today] ?? 0;
  const elapsed = work.filter((d) => d <= today).length;
  return {
    monthlyTarget,
    dailyTarget: isWorkday(today) && perDay > 0 ? perDay : null,
    todayActual,
    todayPct: isWorkday(today) && perDay > 0 ? (100 * todayActual) / perDay : null,
    mtdActual: cumActual,
    mtdPct: monthlyTarget > 0 ? (100 * cumActual) / monthlyTarget : null,
    pacePct: work.length ? (100 * elapsed) / work.length : null,
    workdays: work.length,
    elapsedWorkdays: elapsed,
    series,
  };
}

// Angka Rupiah gaya Indonesia: "50.000.000", "Rp 50.000.000", "50000000", "50jt" tidak didukung (sengaja, agar tidak salah tafsir).
export function parseRupiah(input: string): number | null {
  const s = input.trim().replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
  if (s === "") return null;
  const digits = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  if (!/^\d+$/.test(digits)) return NaN;
  return Number(digits);
}
