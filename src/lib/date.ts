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
