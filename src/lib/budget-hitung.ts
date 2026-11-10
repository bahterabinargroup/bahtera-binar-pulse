import "server-only";
// Hitungan budget per hari. SENGAJA hanya di server: penyesuaian fase bulan (push/steady) bersifat rahasia
// dan tidak boleh terbaca di browser ADV. Jangan impor file ini dari komponen client.
import { addDays, levelOf, PPN_PCT, type Hasil, type Level, type Parsed } from "@/lib/budget";

// Hash kecil yang stabil: input sama => angka sama (ADV tidak melihat angka berubah tiap dibuka).
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// Fase menurut tanggal kalender (bulan 30 hari: 1–10 push, 11–22 steady, 23–akhir push; bulan lain proporsional).
function fase(ymd: string): "push" | "steady" {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pushAwal = Math.round((n * 10) / 30);
  const steadyAkhir = Math.round((n * 22) / 30);
  return d <= pushAwal ? "push" : d <= steadyAkhir ? "steady" : "push";
}

function penyesuaian(ymd: string, cap: number, toko: string): number {
  const u = hash01(`bb-pulse|${ymd}|${cap}|${toko.trim().toLowerCase()}`);
  return fase(ymd) === "push" ? 0.092 + u * 0.017 : -(0.061 + u * 0.016);
}

export function hitungBudget(p: Parsed, level: Level, toko: string): Hasil {
  const capEvent = p.event ? p.cap * 2 : null;
  const hari: Hasil["hari"] = [];
  for (let i = 0; i < p.days; i++) {
    const tanggal = addDays(p.start, i);
    const isEvent = p.event && tanggal >= p.event.start && tanggal <= p.event.end;
    const dasar = isEvent ? p.cap * 2 : p.cap;
    const budget = Math.round(dasar * (1 + penyesuaian(tanggal, p.cap, toko)));
    hari.push({ tanggal, budget, ppn: Math.round(budget * (1 + PPN_PCT / 100)) });
  }
  const budget = hari.reduce((a, h) => a + h.budget, 0);
  const cadanganPct = levelOf(level).pct;
  const cadangan = Math.round((budget * cadanganPct) / 100);
  const totalNetto = budget + cadangan;
  return {
    budget,
    rataPerHari: Math.round(budget / p.days),
    hari,
    capEvent,
    targetOmset: Math.round(budget / (p.cac / 100)),
    level,
    cadanganPct,
    cadangan,
    totalNetto,
    kas: Math.round(totalNetto * (1 + PPN_PCT / 100)),
    omsetMin: Math.round(budget / (p.cac / 100)),
    omsetMinCadangan: Math.round(totalNetto / (p.cac / 100)),
  };
}
