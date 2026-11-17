"use client";

import { labelCls } from "@/components/owner/ui";
import { mapsUrl } from "@/lib/presensi";
import type { LokasiCek } from "@/lib/geo";
import { MAX_ACCURACY_M } from "@/lib/geo";
import type { GpsState } from "./useGps";

export function GpsBox({ gps, onRetry, cek }: { gps: GpsState; onRetry: () => void; cek?: LokasiCek }) {
  return (
    <div>
      <p className={labelCls}>Lokasi (otomatis)</p>
      <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
        {gps.s === "mencari" && <p className="text-zinc-600">Mengambil lokasi… Izinkan akses lokasi bila peramban bertanya.</p>}
        {gps.s === "ok" && (
          <p>
            ✓ Lokasi terambil ({gps.gps.lat.toFixed(5)}, {gps.gps.lng.toFixed(5)}, akurasi ±{Math.round(gps.gps.accuracy)} m).{" "}
            <a href={mapsUrl(gps.gps.lat.toFixed(6), gps.gps.lng.toFixed(6))} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">
              Lihat di Google Maps
            </a>
          </p>
        )}
        {gps.s === "gagal" && <p className="text-amber-800">{gps.pesan}</p>}
        {gps.s === "ok" && cek?.s === "ok" && (
          <p role="status" className="mt-2 font-bold text-green-800">✓ Anda {Math.round(cek.dist)} m dari {cek.point.name} (batas {cek.point.radius_m} m). Bisa absen.</p>
        )}
        {gps.s === "ok" && cek?.s === "jauh" && (
          <p role="alert" className="mt-2 font-bold text-red-700">
            Anda {Math.round(cek.dist)} m dari {cek.point.name}. Absen WFO hanya bisa dalam radius {cek.point.radius_m} m. Datangi lokasi kantor, lalu ambil lokasi ulang.
          </p>
        )}
        {gps.s === "ok" && cek?.s === "akurasi" && (
          <p role="alert" className="mt-2 font-bold text-amber-800">
            Akurasi GPS kurang tepat (±{Math.round(cek.accuracy)} m, harus {MAX_ACCURACY_M} m atau lebih baik). Tunggu sebentar atau dekat jendela, lalu tekan &quot;Ambil lokasi ulang&quot;.
          </p>
        )}
        {gps.s === "gagal" && cek && cek.s !== "bebas" && <p className="mt-2 font-bold text-red-700">Absen WFO wajib di lokasi kantor, jadi lokasi harus terbaca.</p>}
        {gps.s !== "mencari" && (
          <button type="button" onClick={onRetry} className="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-bold">
            Ambil lokasi ulang
          </button>
        )}
      </div>
    </div>
  );
}
