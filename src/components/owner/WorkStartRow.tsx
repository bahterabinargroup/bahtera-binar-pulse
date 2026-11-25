"use client";

import { useState, useTransition } from "react";
import { setWorkStart } from "@/app/(app)/mulai-kerja/actions";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { Result } from "./ActionForm";

// Satu baris karyawan: isi tanggal mulai kerja lalu Simpan. Kosong = kuota cuti direset tanggal 1.
export function WorkStartRow({ id, name, detail, initial }: { id: string; name: string; detail: string; initial: string | null }) {
  const [date, setDate] = useState(initial ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const changed = date !== (initial ?? "");
  const day = date ? Number(date.slice(8, 10)) : null;
  return (
    <li className="py-3">
      <p className="font-bold">{name}</p>
      <p className="text-sm text-zinc-600">{detail}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm">
          Mulai kerja
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={`Tanggal mulai kerja ${name}`} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm" />
        </label>
        <button
          type="button"
          disabled={!changed || pending}
          onClick={() => start(async () => setResult(await setWorkStart(id, date || null)))}
          className="rounded-lg bg-accent px-3 py-1 text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? "…" : "Simpan"}
        </button>
        {result && <Result result={result} />}
      </div>
      <p className="mt-1 text-xs text-zinc-600">{day ? `Kuota cuti/izin direset setiap tanggal ${day}.` : "Kosong: kuota cuti/izin direset setiap tanggal 1."}</p>
    </li>
  );
}
