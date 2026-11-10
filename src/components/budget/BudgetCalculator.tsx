"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hitungPengajuan } from "@/app/(app)/budget/actions";
import { inputCls, labelCls, cardCls } from "@/components/owner/ui";
import {
  cekInput, EMPTY_INPUT, hariNama, hariTgl, LEVELS, levelOf, MAX_ALASAN, pct, PPN_PCT, rp, saranLevel, teksWhatsApp, tglPendek,
  type Hasil, type Level, type RawInput,
} from "@/lib/budget";

export function BudgetCalculator({ defaultAdv }: { defaultAdv: string }) {
  const [r, setR] = useState<RawInput>({ ...EMPTY_INPUT, adv: defaultAdv });
  const [hasilServer, setHasil] = useState<{ kunci: string; h: Hasil } | null>(null);
  const [salin, setSalin] = useState<"" | "ok" | "gagal">("");
  const [teksTampil, setTeksTampil] = useState(false);
  const reqId = useRef(0);

  const set = <K extends keyof RawInput>(k: K, v: RawInput[K]) => setR((p) => ({ ...p, [k]: v }));
  const c = useMemo(() => cekInput(r), [r]);
  const level: Level = c.locked ? "none" : r.level;
  
  // Hitung di server setiap isian berubah (ditunda sebentar); jawaban lama diabaikan.
  const kunci = JSON.stringify([r.cap, r.start, r.cac, r.eventOn, r.eventStart, r.eventEnd, level, r.toko, c.core ? 1 : 0]);
  const hasil = c.core && hasilServer?.kunci === kunci ? hasilServer.h : null; // hasil usang tidak dipakai
  useEffect(() => {
    const id = ++reqId.current;
    if (!c.core) return;
    const t = setTimeout(async () => {
      const res = await hitungPengajuan({ ...r, level }).catch(() => ({ ok: false as const }));
      if (id === reqId.current) setHasil(res.ok ? { kunci, h: res.hasil } : null);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);

  const lengkap = c.missing.length === 0 && !!hasil;
  const teks = lengkap && hasil ? teksWhatsApp({ ...r, level }, c, hasil) : "";
  const saran = r.eventOn && c.core?.event && level === "none" && !c.locked ? saranLevel(c.core.event.days) : null;

  async function salinTeks() {
    try {
      await navigator.clipboard.writeText(teks);
      setSalin("ok");
    } catch {
      setSalin("gagal");
      setTeksTampil(true);
    }
    setTimeout(() => setSalin(""), 3000);
  }

  const err = (k: keyof RawInput) => (c.errors[k] ? <span className="mt-1 block text-xs font-normal text-red-700">{c.errors[k]}</span> : null);
  const bandingCac = c.prevCac !== null && c.core ? (c.prevCac <= c.core.cac ? "hijau" : "kuning") : null;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {/* ---------- Isian ---------- */}
      <section className={cardCls}>
        <h2 className="font-bold">Isian</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            Nama ADV *
            <input value={r.adv} onChange={(e) => set("adv", e.target.value)} maxLength={60} className={inputCls} />
          </label>
          <label className={labelCls}>
            Toko *
            <input value={r.toko} onChange={(e) => set("toko", e.target.value)} maxLength={60} className={inputCls} />
          </label>
          <label className={labelCls}>
            Cap harian (Rp) *
            <input inputMode="numeric" value={r.cap} onChange={(e) => set("cap", e.target.value)} className={inputCls} />
            {err("cap")}
          </label>
          <label className={labelCls}>
            Target CAC pribadi ADV (%) *
            <input inputMode="decimal" value={r.cac} onChange={(e) => set("cac", e.target.value)} className={inputCls} />
            {err("cac")}
          </label>
        </div>
        <p className="mt-1 text-xs text-zinc-600">Target CAC pribadi: jangan disamakan dengan target universal, lebih rendah untuk mengantisipasi kemungkinan terburuk.</p>

        <div className="mt-3">
          <label className={labelCls}>
            Tanggal mulai budget *
            <input type="date" value={r.start} onChange={(e) => set("start", e.target.value)} className={`${inputCls} sm:max-w-56`} />
          </label>
          {c.core && (
            <p className="mt-1 text-xs text-zinc-600">
              {hariTgl(c.core.start)} – {hariTgl(c.core.end)} ({c.core.days} hari)
            </p>
          )}
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={r.eventOn} onChange={(e) => setR((p) => ({ ...p, eventOn: e.target.checked, eventStart: "", eventEnd: "" }))} className="size-4" />
          Ada spesial event
        </label>
        {r.eventOn && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Event mulai *
              <input type="date" value={r.eventStart} min={c.eventMin || undefined} max={c.eventMax || undefined} onChange={(e) => set("eventStart", e.target.value)} className={inputCls} />
              {err("eventStart")}
            </label>
            <label className={labelCls}>
              Event selesai *
              <input type="date" value={r.eventEnd} min={r.eventStart || c.eventMin || undefined} max={c.eventMax || undefined} onChange={(e) => set("eventEnd", e.target.value)} className={inputCls} />
              {err("eventEnd")}
            </label>
            <p className="text-xs text-zinc-600 sm:col-span-2">Cap hari event otomatis 2× cap harian.</p>
          </div>
        )}

        <h3 className="mt-5 font-bold">Hasil pengajuan budget sebelumnya (lihat dashboard mitra yang sudah termasuk pajak)</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            Tanggal mulai *
            <input type="date" value={r.prevStart} max={c.core ? addDaysStr(c.core.start, -2) : undefined} onChange={(e) => set("prevStart", e.target.value)} className={inputCls} />
            {err("prevStart")}
          </label>
          <label className={labelCls}>
            Tanggal selesai *
            <input type="date" value={r.prevEnd} min={r.prevStart ? addDaysStr(r.prevStart, 1) : undefined} max={c.core ? addDaysStr(c.core.start, -1) : undefined} onChange={(e) => set("prevEnd", e.target.value)} className={inputCls} />
            {err("prevEnd")}
          </label>
          <label className={labelCls}>
            Budget (jumlah) *
            <input inputMode="numeric" value={r.prevBudget} onChange={(e) => set("prevBudget", e.target.value)} className={inputCls} />
            {err("prevBudget")}
          </label>
          <label className={labelCls}>
            Omset (jumlah) *
            <input inputMode="numeric" value={r.prevOmset} onChange={(e) => set("prevOmset", e.target.value)} className={inputCls} />
            {err("prevOmset")}
          </label>
          <label className={`${labelCls} sm:col-span-2`}>
            CAC rata-rata
            <input readOnly tabIndex={-1} value={c.prevCac !== null ? `${pct(c.prevCac)}` : "otomatis"} className={`${inputCls} bg-zinc-50 text-zinc-600`} />
          </label>
        </div>

        <label className={`${labelCls} mt-5`}>
          Dana cadangan scale-up
          <select value={level} disabled={c.locked} onChange={(e) => set("level", e.target.value as Level)} className={`${inputCls} sm:max-w-56`}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </label>
        {c.locked && c.prevCac !== null && (
          <p className="mt-1 text-xs font-bold text-amber-700">CAC pengajuan sebelumnya {pct(c.prevCac)} (di atas 30%): tidak boleh meminta dana cadangan.</p>
        )}
        {saran && <p className="mt-1 text-xs font-bold text-amber-700">{saran.text}</p>}
        {level !== "none" && (
          <label className={`${labelCls} mt-3`}>
            Pertimbangan meminta cadangan segitu *
            <textarea value={r.alasan} maxLength={MAX_ALASAN} rows={2} onChange={(e) => set("alasan", e.target.value)} className={inputCls} />
          </label>
        )}
      </section>

      {/* ---------- Hasil ---------- */}
      <section className={cardCls}>
        <h2 className="font-bold">Hasil</h2>
        {!hasil || !c.core ? (
          <p className="mt-3 text-sm text-zinc-600">Isi data di kolom Isian untuk melihat hasil.</p>
        ) : (
          <>
            <dl className="mt-3 divide-y divide-zinc-100 text-sm">
              <Row k="Periode" v={`${tglPendek(c.core.start)} – ${tglPendek(c.core.end)} (${c.core.days} hari)`} />
              {c.core.event && hasil.capEvent && <Row k="Spesial event" v={`${c.core.event.days} hari (cap event ${rp(hasil.capEvent)}/hari)`} />}
              <Row k="Budget iklan" v={`${rp(hasil.budget)} (± ${rp(hasil.rataPerHari)}/hari)`} />
              <Row k="Target omset" v={rp(hasil.targetOmset)} />
              {hasil.level !== "none" && <Row k={`Dana cadangan ${levelOf(hasil.level).label}`} v={rp(hasil.cadangan)} />}
              <Row k="Total diajukan (netto)" v={rp(hasil.totalNetto)} bold />
              <Row k={`Kas top up + PPN ${PPN_PCT}%`} v={rp(hasil.kas)} bold />
            </dl>

            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
              <b>Kesimpulan:</b> Dengan budget {rp(hasil.budget)} dan target CAC pribadi {pct(c.core.cac)}, kamu harus mencetak omset minimal <b>{rp(hasil.omsetMin)}</b>.
              {hasil.level !== "none" && <> Kalau cadangan {rp(hasil.cadangan)} ikut terpakai, omset yang dicetak minimal <b>{rp(hasil.omsetMinCadangan)}</b>.</>}
            </div>

            {bandingCac && c.prevCac !== null && (
              <p className={`mt-3 rounded-lg p-2 text-sm ${bandingCac === "hijau" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
                {bandingCac === "hijau"
                  ? `CAC pengajuan sebelumnya ${pct(c.prevCac)}, sudah di bawah target ${pct(c.core.cac)}.`
                  : `CAC pengajuan sebelumnya ${pct(c.prevCac)}, di atas target ${pct(c.core.cac)}. Siapkan penjelasan perbaikannya.`}
              </p>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-accent text-left text-white">
                    <th className="px-2 py-1">Hari</th>
                    <th className="px-2 py-1 text-right">Budget</th>
                    <th className="px-2 py-1 text-right">+ PPN {PPN_PCT}%</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.hari.map((h) => (
                    <tr key={h.tanggal} className="border-b border-zinc-100">
                      <td className="px-2 py-1">{hariNama(h.tanggal)}, {tglPendek(h.tanggal)}</td>
                      <td className="px-2 py-1 text-right">{rp(h.budget)}</td>
                      <td className="px-2 py-1 text-right">{rp(h.ppn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!lengkap} onClick={salinTeks} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
            Salin ringkasan (WhatsApp)
          </button>
          <button type="button" disabled={!lengkap} onClick={() => setTeksTampil((v) => !v)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40">
            {teksTampil ? "Sembunyikan teks" : "Tampilkan teks"}
          </button>
          {salin === "ok" && <span role="status" className="text-sm text-green-700">✓ Tersalin</span>}
          {salin === "gagal" && <span role="alert" className="text-sm text-red-700">Gagal menyalin, salin manual dari teks di bawah.</span>}
        </div>
        {!lengkap && c.missing.length > 0 && (
          <p className="mt-2 text-xs text-zinc-600">Lengkapi dulu agar bisa disalin: {[...new Set(c.missing)].join(", ")}.</p>
        )}
        {teksTampil && lengkap && (
          <textarea readOnly value={teks} rows={14} className={`${inputCls} mt-3 font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
        )}
      </section>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
      <dt className="text-zinc-600">{k}</dt>
      <dd className={bold ? "font-bold" : ""}>{v}</dd>
    </div>
  );
}

function addDaysStr(s: string, n: number) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
