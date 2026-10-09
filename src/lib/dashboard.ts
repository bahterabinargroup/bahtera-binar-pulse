// Perhitungan untuk dashboard utama. Fungsi murni (tanpa akses database) agar mudah diuji.
// Definisi kepatuhan mengikuti database (get_weekly_report_compliance): yang wajib lapor
// = pengguna aktif ber-role employee atau manager, hari kerja Senin-Sabtu, hari sebelum
// akun dibuat tidak dihitung.

import { addDays, todayJakarta } from "@/lib/date";

export type Periode = "hari" | "7" | "30" | "bulan";
export const PERIODE_LABEL: Record<Periode, string> = { hari: "Hari ini", "7": "7 hari", "30": "30 hari", bulan: "Bulan ini" };

export const parsePeriode = (v: unknown): Periode => (v === "hari" || v === "7" || v === "30" || v === "bulan" ? v : "7");

export function periodRange(p: Periode, today: string): { from: string; to: string } {
  if (p === "hari") return { from: today, to: today };
  if (p === "bulan") return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: addDays(today, -(Number(p) - 1)), to: today };
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const isWorkday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay() !== 0; // Senin-Sabtu

// ---------- Kepatuhan ----------

export type UserLite = { id: string; role: string; is_active: boolean; created_at: string; position_id: number | null };
export type ReportLite = { user_id: string; report_date: string; position_id: number | null; presensi: string | null };

const mustReport = (u: UserLite) => u.is_active && (u.role === "employee" || u.role === "manager");
const createdDay = (u: UserLite) => todayJakarta(new Date(u.created_at));

export type DayCompliance = { day: string; expected: number; filled: number; pct: number };

export function complianceByDay(users: UserLite[], reports: ReportLite[], days: string[]): DayCompliance[] {
  const eligible = users.filter(mustReport);
  const byDay = new Map<string, Set<string>>();
  for (const r of reports) {
    if (!byDay.has(r.report_date)) byDay.set(r.report_date, new Set());
    byDay.get(r.report_date)!.add(r.user_id);
  }
  const out: DayCompliance[] = [];
  for (const day of days) {
    if (!isWorkday(day)) continue;
    const expectedUsers = eligible.filter((u) => createdDay(u) <= day);
    if (expectedUsers.length === 0) continue;
    const filledSet = byDay.get(day) ?? new Set<string>();
    const filled = expectedUsers.filter((u) => filledSet.has(u.id)).length;
    out.push({ day, expected: expectedUsers.length, filled, pct: (100 * filled) / expectedUsers.length });
  }
  return out;
}

export function complianceTotal(days: DayCompliance[]): { expected: number; filled: number; pct: number | null } {
  const expected = days.reduce((s, d) => s + d.expected, 0);
  const filled = days.reduce((s, d) => s + d.filled, 0);
  return { expected, filled, pct: expected ? (100 * filled) / expected : null };
}

export type GroupCompliance = { key: string; name: string; expected: number; filled: number; pct: number };

export function complianceByPosition(
  users: UserLite[],
  reports: ReportLite[],
  days: string[],
  positionNames: Record<number, string>,
): GroupCompliance[] {
  const groups = new Map<string, UserLite[]>();
  for (const u of users.filter(mustReport)) {
    const key = u.position_id === null ? "none" : String(u.position_id);
    groups.set(key, [...(groups.get(key) ?? []), u]);
  }
  const out: GroupCompliance[] = [];
  for (const [key, members] of groups) {
    const ids = new Set(members.map((m) => m.id));
    const t = complianceTotal(complianceByDay(members, reports.filter((r) => ids.has(r.user_id)), days));
    if (t.expected === 0 || t.pct === null) continue;
    out.push({
      key,
      name: key === "none" ? "Tanpa jabatan" : (positionNames[Number(key)] ?? "Divisi"),
      expected: t.expected,
      filled: t.filled,
      pct: t.pct,
    });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

export function presenceRate(reports: ReportLite[]): { sudah: number; total: number } {
  const withKey = reports.filter((r) => r.presensi !== null);
  return { sudah: withKey.filter((r) => r.presensi === "Sudah").length, total: withKey.length };
}

// ---------- ADV: omzet, biaya iklan, CAC ----------

export type AdvRow = {
  user_id: string;
  report_date: string;
  toko: string | null;
  data_toko: unknown;
  tarik: string | null;
  tracker: string | null;
  brief: string | null;
  presensi: string | null;
};

export type Totals = { gmv: number; pesanan: number; ads: number; impresi: number };
export type AdvDay = Totals & { day: string; n: number }; // n = jumlah isian toko pada hari itu (0 = tanpa data)
export type TokoAgg = { key: string; name: string; gmv: number; pesanan: number; ads: number };
export type AdvAgg = {
  reports: number;
  total: Totals;
  days: AdvDay[];
  toko: TokoAgg[];
  checklist: { label: string; sudah: number; total: number }[];
  hasMoney: boolean;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const hasNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

export const tokoKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

// CAC (%) = ads spent ÷ GMV x 100, sama dengan "CAC TIKTOK" di dashboard mitra.
export const cacPct = (ads: number, gmv: number) => (gmv > 0 ? (100 * ads) / gmv : null);
export const roas = (ads: number, gmv: number) => (ads > 0 ? gmv / ads : null);

export function aggregateAdv(rows: AdvRow[], days: string[]): AdvAgg {
  const dayMap = new Map<string, Totals & { n: number }>(days.map((d) => [d, { gmv: 0, pesanan: 0, ads: 0, impresi: 0, n: 0 }]));
  const tokoMap = new Map<string, TokoAgg>();
  const total: Totals = { gmv: 0, pesanan: 0, ads: 0, impresi: 0 };
  let hasMoney = false;

  for (const r of rows) {
    const entities = Array.isArray(r.data_toko) ? (r.data_toko as Record<string, unknown>[]) : [];
    entities.forEach((e, i) => {
      if (!e || typeof e !== "object") return;
      const g = num(e.gmv), p = num(e.jumlah_pesanan), a = num(e.ads_spent), im = num(e.impresi_harian);
      const any = hasNum(e.gmv) || hasNum(e.jumlah_pesanan) || hasNum(e.ads_spent) || hasNum(e.impresi_harian);
      if (!any) return;
      if (g || a) hasMoney = true;
      const d = dayMap.get(r.report_date);
      if (d) {
        d.gmv += g; d.pesanan += p; d.ads += a; d.impresi += im; d.n += 1;
      }
      total.gmv += g; total.pesanan += p; total.ads += a; total.impresi += im;
      const raw = (typeof e.nama === "string" && e.nama.trim()) || (i === 0 && r.toko?.trim()) || "(tanpa nama)";
      const key = tokoKey(raw);
      const t = tokoMap.get(key) ?? { key, name: raw, gmv: 0, pesanan: 0, ads: 0 };
      t.gmv += g; t.pesanan += p; t.ads += a;
      tokoMap.set(key, t);
    });
  }

  const count = (pick: (r: AdvRow) => string | null) => rows.filter((r) => pick(r) === "Sudah").length;
  return {
    reports: rows.length,
    total,
    days: days.map((day) => ({ day, ...dayMap.get(day)! })),
    toko: [...tokoMap.values()].sort((a, b) => b.gmv - a.gmv),
    checklist: [
      { label: "Presensi mandiri", sudah: count((r) => r.presensi), total: rows.length },
      { label: "Tarik data penjualan", sudah: count((r) => r.tarik), total: rows.length },
      { label: "Input tracker & ads spent", sudah: count((r) => r.tracker), total: rows.length },
      { label: "Brief konten, QC, upload", sudah: count((r) => r.brief), total: rows.length },
    ],
    hasMoney,
  };
}
