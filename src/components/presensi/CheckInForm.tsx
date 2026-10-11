"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkIn } from "@/app/(app)/presensi/actions";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { noteRequired, photoPath, PRESENSI_BUCKET, PRESENSI_STATUS } from "@/lib/presensi";
import { createClient } from "@/lib/supabase/client";
import { GpsBox } from "./GpsBox";
import { PhotoField } from "./PhotoField";
import { useGps } from "./useGps";

export function CheckInForm({ companyId, userId, today }: { companyId: string; userId: string; today: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const { gps, retry } = useGps();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!status) return setError("Pilih status kehadiran.");
    if (noteRequired(status) && !note.trim()) return setError("Alasan / catatan wajib diisi untuk status ini.");
    if (status === "tugas_luar" && !photo) return setError("Foto bukti diminta tugas luar wajib diunggah.");

    setBusy(true);
    try {
      let path: string | null = null;
      if (photo && showPhoto) {
        path = photoPath(companyId, userId, today, "masuk");
        const { error: upErr } = await createClient()
          .storage.from(PRESENSI_BUCKET)
          .upload(path, photo, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw new Error(`Foto gagal diunggah: ${upErr.message}`);
      }
      const g = gps.s === "ok" ? gps.gps : null;
      const res = await checkIn({ status, note, lat: g?.lat ?? null, lng: g?.lng ?? null, accuracy: g?.accuracy ?? null, photoPath: path });
      if (!res.ok) throw new Error(res.error);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const needNote = noteRequired(status);
  const showPhoto = status === "tugas_luar" || status === "izin" || status === "sakit";

  return (
    <form onSubmit={submit} className={`${cardCls} mt-4 space-y-4`}>
      <label className={labelCls}>
        Status kehadiran
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPhoto(null); }} className={inputCls} required>
          <option value="">— Pilih —</option>
          {PRESENSI_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className={labelCls}>
        Alasan / catatan {needNote ? <span className="text-red-700">(wajib)</span> : <span className="font-normal text-zinc-500">(opsional)</span>}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={inputCls} />
      </label>

      <GpsBox gps={gps} onRetry={retry} />

      {status === "tugas_luar" && (
        <PhotoField key="tugas_luar" label="Foto bukti diminta tugas luar" required buttonText="Ketuk untuk ambil / pilih foto bukti" onChange={setPhoto} />
      )}
      {(status === "izin" || status === "sakit") && (
        <>
          <PhotoField key={status} label={status === "sakit" ? "Foto bukti / surat sakit" : "Foto bukti / surat izin"} buttonText="Ketuk untuk ambil / pilih foto" onChange={setPhoto} />
          <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">Untuk {status === "sakit" ? "Sakit" : "Izin"}, Check-Out tercatat otomatis. Anda tidak perlu Check-Out lagi.</p>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60">
        {busy ? "Menyimpan…" : "Check-In"}
      </button>
    </form>
  );
}
