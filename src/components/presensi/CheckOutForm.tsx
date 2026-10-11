"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkOut } from "@/app/(app)/presensi/actions";
import { cardCls } from "@/components/owner/ui";
import { photoPath, PRESENSI_BUCKET } from "@/lib/presensi";
import { createClient } from "@/lib/supabase/client";
import { GpsBox } from "./GpsBox";
import { PhotoField } from "./PhotoField";
import { useGps } from "./useGps";

// Check-Out: lokasi terbaru otomatis, foto selfie / bukti pulang WAJIB.
export function CheckOutForm({ companyId, userId, today }: { companyId: string; userId: string; today: string }) {
  const router = useRouter();
  const { gps, retry } = useGps();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!photo) return setError("Foto selfie / bukti pulang wajib diisi.");
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
    <form onSubmit={submit} className={`${cardCls} mt-4 space-y-4`}>
      <h2 className="text-lg font-bold text-accent">Check-Out (pulang)</h2>
      <GpsBox gps={gps} onRetry={retry} />
      <PhotoField label="Foto selfie / bukti pulang" hint={<span className="text-red-700">(wajib)</span>} camera="user" onChange={setPhoto} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60">
        {busy ? "Menyimpan…" : "Check-Out"}
      </button>
    </form>
  );
}
