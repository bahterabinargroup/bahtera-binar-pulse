// Jarak ke titik absen (WFO). Aturan sebenarnya dijaga database (supabase/021); ini hanya untuk tampilan agar karyawan tahu lebih dulu.
import type { Gps } from "@/lib/presensi";

export type AbsenPoint = { id: string; name: string; lat: number; lng: number; radius_m: number };

export const DEFAULT_RADIUS_M = 15;
export const MAX_ACCURACY_M = 25; // akurasi GPS terburuk yang diterima untuk WFO

// Rumus haversine (meter).
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type LokasiCek =
  | { s: "bebas" } // aturan radius tidak berlaku (bukan WFO, atau company belum punya titik)
  | { s: "menunggu" }
  | { s: "akurasi"; accuracy: number }
  | { s: "ok"; point: AbsenPoint; dist: number }
  | { s: "jauh"; point: AbsenPoint; dist: number };

// gps: null = belum terbaca. enforced = WFO dan company punya titik aktif.
export function cekLokasi(gps: Gps | null, points: AbsenPoint[], enforced: boolean): LokasiCek {
  if (!enforced || points.length === 0) return { s: "bebas" };
  if (!gps) return { s: "menunggu" };
  if (gps.accuracy > MAX_ACCURACY_M) return { s: "akurasi", accuracy: gps.accuracy };
  const ranked = points
    .map((p) => ({ point: p, dist: distanceM(gps.lat, gps.lng, p.lat, p.lng) }))
    .sort((a, b) => a.dist - b.dist);
  const inside = ranked.find((r) => r.dist <= r.point.radius_m);
  return inside ? { s: "ok", ...inside } : { s: "jauh", ...ranked[0] };
}

export const lokasiBoleh = (c: LokasiCek) => c.s === "bebas" || c.s === "ok";
