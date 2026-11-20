"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkOut } from "@/app/(app)/presensi/actions";
import { photoPath, PRESENSI_BUCKET } from "@/lib/presensi";
import { createClient } from "@/lib/supabase/client";
import { cekLokasi, lokasiBoleh, pointKindFor, type AbsenPoint } from "@/lib/geo";
import { GpsBox } from "./GpsBox";
import { PhotoField } from "./PhotoField";
import { useGps } from "./useGps";

// Check-Out: lokasi terbaru otomatis, foto selfie / bukti pulang WAJIB.
export function CheckOutForm({ companyId, userId, today, status, points }: { companyId: string; userId: string; today: string; status: string; points: AbsenPoint[] }) {
  const router = useRouter();
  const { gps, retry } = useGps();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const kind = pointKindFor(status);
  const cek = cekLokasi(gps.s === "ok" ? gps.gps : null, points.filter((p) => p.kind === kind), kind !== null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!photo) return setError("Foto selfie / bukti pulang wajib diisi.");
    if (!lokasiBoleh(cek)) return setError(kind === "tujuan" ? "Check-Out Tugas Luar hanya bisa di dalam radius titik tujuan yang sudah didaftarkan. Lihat keterangan lokasi di bawah foto." : "Check-Out WFO hanya bisa di dalam radius titik absen. Lihat keterangan lokasi di bawah foto.");
    setBusy(true);
    try {
      const path = photoPath(companyId, userId, today, "pulang");
      const { error: upErr } = await createClient()
        .storage.from(PRESENSI_BUCKET)
        .upload(path, photo, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(`Foto gagal diunggah: ${upErr.message}`);
      const g = gps.s === "ok" ? gps.gps : null;
      const res = await checkOut({ lat: g?.lat ?? null, lng: g?.lng ?? null, accuracy: g?.accuracy ?? null, photoPath: path });
      if (!res.ok) throw new Error(res.error);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border-2 border-accent bg-white p-4 shadow-md">
      <div>
        <h2 className="text-xl font-bold text-accent">Waktunya pulang? Check-Out di sini</h2>
        <p className="mt-1 text-sm text-zinc-600">Dua langkah: <b>1)</b> ambil foto selfie, <b>2)</b> tekan tombol Check-Out.</p>
      </div>
      <PhotoField label="Langkah 1 — Foto selfie / bukti pulang" required camera="user" buttonText="Ketuk di sini untuk ambil foto selfie" onChange={setPhoto} />
      <GpsBox gps={gps} onRetry={retry} cek={cek} kind={kind} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={busy || !photo || !lokasiBoleh(cek)}
          className="w-full rounded-lg bg-accent px-4 py-3 text-base font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Menyimpan…" : "Langkah 2 — Check-Out"}
        </button>
        {!photo && <p className="mt-1 text-xs text-zinc-600">Tombol aktif setelah foto selfie siap{cek.s !== "bebas" ? " dan lokasi Anda di dalam radius titik absen" : ""}.</p>}
      </div>
    </form>
  );
}
