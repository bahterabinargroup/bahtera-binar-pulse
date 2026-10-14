// Cuti / izin: label, bentuk data, dan hitungan tanggal. Aturan sebenarnya dijaga database (supabase/011 dan 012).
import { dateFromYmd } from "@/lib/date";
import { eachDay, isWorkday } from "@/lib/dashboard";

export type LeaveKind = "cuti" | "izin";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_KINDS: { value: LeaveKind; label: string }[] = [
  { value: "cuti", label: "Cuti" },
  { value: "izin", label: "Izin" },
];

export const kindLabel = (k: string) => (k === "cuti" ? "Cuti" : k === "izin" ? "Izin" : k);

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "Menunggu keputusan",
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
