"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { checkIn } from "@/app/(app)/presensi/actions";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { compressImage, formatKb } from "@/lib/image-compress";
import { mapsUrl, noteRequired, photoPath, PRESENSI_BUCKET, PRESENSI_STATUS, type Gps } from "@/lib/presensi";
import { createClient } from "@/lib/supabase/client";

type GpsState = { s: "mencari" } | { s: "ok"; gps: Gps } | { s: "gagal"; pesan: string };

export function CheckInForm({ companyId, userId, today }: { companyId: string; userId: string; today: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [gps, setGps] = useState<GpsState>({ s: "mencari" });
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoMsg, setPhotoMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

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

  function getLocation() {
    setGps({ s: "mencari" });
    locate();
  }

  // Lokasi diminta otomatis begitu halaman dibuka (keadaan awal sudah "mencari").
  useEffect(() => {
    locate();
  }, [locate]);

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhoto(null);
    setPhotoMsg("");
    if (!file) return;
    setPhotoMsg("Mengecilkan foto…");
    try {
      const blob = await compressImage(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
      setPhotoMsg(`Foto siap (${formatKb(file.size)} → ${formatKb(blob.size)}).`);
    } catch (err) {
      setPhotoMsg(err instanceof Error ? err.message : "Foto tidak bisa diproses.");
      e.target.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!status) return setError("Pilih status kehadiran.");
    if (noteRequired(status) && !note.trim()) return setError("Alasan / catatan wajib diisi untuk status ini.");

    setBusy(true);
    try {
      let path: string | null = null;
      if (photo) {
        path = photoPath(companyId, userId, today, "masuk");
        const { error: upErr } = await createClient()
          .storage.from(PRESENSI_BUCKET)
          .upload(path, photo.blob, { contentType: "image/jpeg", upsert: false });
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

  return (
    <form onSubmit={submit} className={`${cardCls} mt-4 space-y-4`}>
      <label className={labelCls}>
        Status kehadiran
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} required>
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
            <button type="button" onClick={getLocation} className="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-bold">
              Ambil lokasi ulang
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>
          Foto bukti / surat <span className="font-normal text-zinc-500">(opsional)</span>
          <input type="file" accept="image/*" onChange={onPhoto} className="mt-1 block w-full text-sm" />
        </label>
        {photoMsg && <p className="mt-1 text-xs text-zinc-600">{photoMsg}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo.url} alt="Pratinjau foto" className="mt-2 max-h-48 rounded-lg border border-zinc-200" />}
      </div>

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
