// Presensi harian: pilihan status, aturan catatan, dan link peta. Aturan sebenarnya dijaga database (supabase/008).
export const PRESENSI_STATUS = [
  { value: "wfo", label: "WFO" },
  { value: "tugas_luar", label: "Tugas Luar" },
  { value: "izin", label: "Izin" },
  { value: "sakit", label: "Sakit" },
] as const;

export type PresensiStatus = (typeof PRESENSI_STATUS)[number]["value"];

export function statusLabel(value: string): string {
  return PRESENSI_STATUS.find((s) => s.value === value)?.label ?? value;
}

export function isPresensiStatus(value: string): value is PresensiStatus {
  return PRESENSI_STATUS.some((s) => s.value === value);
}

// Catatan wajib untuk Tugas Luar, Izin, dan Sakit.
export function noteRequired(status: string): boolean {
  return status === "tugas_luar" || status === "izin" || status === "sakit";
}

export function mapsUrl(lat: number | string, lng: number | string): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export const PRESENSI_BUCKET = "presensi";
export const MAX_PHOTO_BYTES = 200 * 1024;

export type Gps = { lat: number; lng: number; accuracy: number };

// Nama berkas foto: {company_id}/{user_id}/{tanggal}-{masuk|pulang}-{acak}.jpg (folder dicek oleh aturan Storage).
export function photoPath(companyId: string, userId: string, day: string, kind: "masuk" | "pulang"): string {
  return `${companyId}/${userId}/${day}-${kind}-${crypto.randomUUID().slice(0, 8)}.jpg`;
}
