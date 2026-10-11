"use client";

import { labelCls } from "@/components/owner/ui";
import { mapsUrl } from "@/lib/presensi";
import type { GpsState } from "./useGps";

export function GpsBox({ gps, onRetry }: { gps: GpsState; onRetry: () => void }) {
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
        {gps.s !== "mencari" && (
          <button type="button" onClick={onRetry} className="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-bold">
            Ambil lokasi ulang
          </button>
        )}
      </div>
    </div>
  );
}
