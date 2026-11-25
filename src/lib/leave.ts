// Cuti / izin: label, bentuk data, dan hitungan tanggal. Aturan sebenarnya dijaga database (supabase/011 dan 012).
import { addDays, dateFromYmd } from "@/lib/date";
import { eachDay, isWorkday } from "@/lib/dashboard";

export type LeaveKind = "cuti" | "izin";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
// Tampilan: "expired" = menunggu keputusan tetapi tanggal selesainya sudah lewat (tidak bisa diputuskan lagi).
export type LeaveShownStatus = LeaveStatus | "expired";

export const LEAVE_KINDS: { value: LeaveKind; label: string }[] = [
  { value: "cuti", label: "Cuti" },
  { value: "izin", label: "Izin" },
];

// Menunggu keputusan tetapi tanggal selesainya sudah lewat = kedaluwarsa (database menolak keputusan atas tanggal lampau).
export const isExpired = (r: { status: string; end_date: string }, today: string) => r.status === "pending" && r.end_date < today;
export const shownStatus = (r: { status: LeaveStatus; end_date: string }, today: string): LeaveShownStatus => (isExpired(r, today) ? "expired" : r.status);

export const kindLabel = (k: string) => (k === "cuti" ? "Cuti" : k === "izin" ? "Izin" : k);

export const STATUS_LABEL: Record<LeaveShownStatus, string> = {
  pending: "Menunggu keputusan",
  expired: "Kedaluwarsa",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

export type LeaveRow = {
  id: string;
  user_id: string;
  company_id: string;
  kind: LeaveKind;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  cancel_requested_at: string | null;
  cancel_reason: string | null;
  cancel_outcome: "approved" | "rejected" | null;
  cancel_decided_at: string | null;
  cancel_note: string | null;
};

export const LEAVE_COLUMNS =
  "id, user_id, company_id, kind, start_date, end_date, reason, status, decided_by, decided_at, decision_note, created_at, cancel_requested_at, cancel_reason, cancel_outcome, cancel_decided_at, cancel_note";

export const fmtTanggal = (ymd: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }).format(dateFromYmd(ymd));

export function fmtRentang(start: string, end: string): string {
  return start === end ? fmtTanggal(start) : `${fmtTanggal(start)} – ${fmtTanggal(end)}`;
}

// Jumlah hari kerja (Senin–Sabtu) dalam rentang.
export const workdaysBetween = (start: string, end: string) => eachDay(start, end).filter(isWorkday).length;

// Pembatalan sedang menunggu keputusan?
export const cancelPending = (r: LeaveRow) => r.status === "approved" && !!r.cancel_requested_at && r.cancel_outcome === null;

// Hari-hari kerja (Senin–Sabtu) dari sebuah pengajuan yang disetujui, dibatasi pada rentang tertentu.
export function leaveDaysIn(r: { start_date: string; end_date: string }, from: string, to: string): string[] {
  const a = r.start_date > from ? r.start_date : from;
  const b = r.end_date < to ? r.end_date : to;
  return a > b ? [] : eachDay(a, b).filter(isWorkday);
}

// Kuota: maksimal 2 pengajuan (cuti + izin) per periode menurut tanggal mulai. Dijaga database (supabase/015, 023).
export const LEAVE_QUOTA_PER_MONTH = 2;
// Lama satu pengajuan: maksimal 2 hari kerja berturut-turut (Senin–Sabtu). Dijaga database (supabase/020).
export const LEAVE_MAX_DAYS = 2;

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const monthName = (ym: string) => `${BULAN[Number(ym.slice(5, 7)) - 1] ?? ym} ${ym.slice(0, 4)}`;

// Periode kuota. Kuota direset menurut TANGGAL MULAI KERJA: masuk tanggal 21 berarti periodenya 21 Nov–20 Des, dst.
// Tanpa tanggal mulai kerja = bulan kalender (tanggal 1). Sama dengan public.leave_period_start di database (supabase/023).
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
function periodStartIn(anchorDay: number, y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(anchorDay, daysInMonth(y, m))).padStart(2, "0")}`;
}
export function leavePeriod(anchor: string | null | undefined, date: string): { start: string; end: string } {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const day = anchor ? Number(anchor.slice(8, 10)) : 1;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const cur = periodStartIn(day, y, m);
  if (cur <= date) return { start: cur, end: addDays(periodStartIn(day, nextY, nextM), -1) };
  return { start: periodStartIn(day, prevY, prevM), end: addDays(cur, -1) };
}

// Jumlah pengajuan yang masih dihitung (menunggu atau disetujui) per periode kuota (kunci = tanggal awal periode).
export function quotaUsage(rows: { status: string; start_date: string; end_date: string }[], anchor: string | null | undefined, today: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.status !== "pending" && r.status !== "approved") continue;
    if (isExpired(r, today)) continue; // kedaluwarsa tidak menghabiskan kuota
    const k = leavePeriod(anchor, r.start_date).start;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
