// Tanggal "hari ini" dan format tanggal selalu dalam WIB (Asia/Jakarta).
export const TIME_ZONE = "Asia/Jakarta";

export function formatHariTanggal(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// "YYYY-MM-DD" hari ini menurut WIB (sama dengan public.today_jakarta()).
export function todayJakarta(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// "2026-10-06" -> Date tengah hari WIB (aman untuk diformat).
export function dateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+07:00`);
}

export function formatJam(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
