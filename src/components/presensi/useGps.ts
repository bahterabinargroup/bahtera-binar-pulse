"use client";

import { useCallback, useEffect, useState } from "react";
import type { Gps } from "@/lib/presensi";

export type GpsState = { s: "mencari" } | { s: "ok"; gps: Gps } | { s: "gagal"; pesan: string };

// Lokasi GPS peramban: diminta otomatis saat komponen tampil; retry() untuk mencoba lagi.
export function useGps() {
  const [gps, setGps] = useState<GpsState>({ s: "mencari" });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setTimeout(() => setGps({ s: "gagal", pesan: "Peramban ini tidak mendukung lokasi." }), 0);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setGps({ s: "ok", gps: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (e) =>
        setGps({
          s: "gagal",
          pesan: e.code === e.PERMISSION_DENIED ? "Izin lokasi ditolak. Aktifkan izin lokasi di peramban, lalu coba lagi." : "Lokasi belum terambil. Coba lagi.",
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  // Keadaan awal sudah "mencari", jadi tidak ada setState sinkron di sini.
  useEffect(() => {
    locate();
  }, [locate]);

  const retry = useCallback(() => {
    setGps({ s: "mencari" });
    locate();
  }, [locate]);

  return { gps, retry };
}
