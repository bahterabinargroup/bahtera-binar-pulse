"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addPoint } from "@/app/(app)/presensi/titik/actions";
import { Result } from "@/components/owner/ActionForm";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { DEFAULT_RADIUS_M } from "@/lib/geo";

// Ambil koordinat dari teks: "-6.2, 106.81" atau tautan Google Maps (@lat,lng / q=lat,lng / !3d..!4d..).
function parseCoords(text: string): { lat: string; lng: string } | null {
  const m = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(text) ?? /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(text);
  return m ? { lat: m[1], lng: m[2] } : null;
}

export function PointForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addPoint, null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setTimeout(() => {
        setLat("");
        setLng("");
        setPaste("");
      }, 0);
    }
  }, [state]);

  function useMyLocation() {
    setMsg("Mengambil lokasi… berdirilah tepat di titik absen.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setMsg(`✓ Lokasi terambil (akurasi ±${Math.round(p.coords.accuracy)} m).${p.coords.accuracy > 15 ? " Akurasi kurang tepat; sebaiknya ambil ulang di tempat terbuka atau tempel dari Google Maps." : ""}`);
      },
      () => setMsg("Lokasi tidak terbaca. Izinkan akses lokasi atau tempel tautan Google Maps."),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  function onPaste(v: string) {
    setPaste(v);
    const c = parseCoords(v);
    if (c) {
      setLat(c.lat);
      setLng(c.lng);
      setMsg("✓ Koordinat dibaca dari tempelan.");
    }
  }

  return (
    <form ref={ref} action={action} className={`${cardCls} mt-4 space-y-3`}>
      <h2 className="font-bold">Tambah titik absen</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelCls}>
          Company *
          <select name="company_id" required defaultValue="" className={inputCls}>
            <option value="" disabled>— Pilih —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Nama titik *
          <input name="name" required maxLength={80} placeholder="mis. Kantor 1" className={inputCls} />
        </label>
        <label className={labelCls}>
          Radius (meter)
          <input name="radius_m" type="number" min={5} max={500} defaultValue={DEFAULT_RADIUS_M} className={inputCls} />
        </label>
      </div>
      <div className="rounded-lg bg-zinc-50 p-3 text-sm">
        <p className="font-bold">Cara menentukan lokasi (pilih salah satu)</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={useMyLocation} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold">
            Pakai lokasi saya sekarang
          </button>
          <span className="text-xs text-zinc-600">atau tempel tautan Google Maps / koordinat:</span>
          <input value={paste} onChange={(e) => onPaste(e.target.value)} placeholder="https://maps.google.com/... atau -6.200000, 106.816666" className={`${inputCls} mt-0 flex-1 min-w-[220px]`} />
        </div>
        {msg && <p className="mt-2 text-xs text-zinc-700">{msg}</p>}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Lintang (lat) *
            <input name="lat" required inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Bujur (lng) *
            <input name="lng" required inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} className={inputCls} />
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60">
          {pending ? "Menyimpan…" : "Tambah titik"}
        </button>
        {state && <Result result={state} />}
      </div>
    </form>
  );
}
