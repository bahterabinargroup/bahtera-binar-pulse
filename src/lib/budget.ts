// Kalkulator pengajuan budget iklan (ADV). Bagian ini AMAN dibaca browser: tipe, tanggal, aturan isian,
// dan penyusun teks WhatsApp. Hitungan angka budget per hari ada di budget-hitung.ts (hanya server).
import { parseNumber } from "@/lib/report/form-state";

export type Level = "none" | "low" | "mid" | "high";
export const LEVELS: { value: Level; label: string; pct: number }[] = [
  { value: "none", label: "Tidak butuh cadangan", pct: 0 },
  { value: "low", label: "Rendah 5%", pct: 5 },
  { value: "mid", label: "Sedang 10%", pct: 10 },
  { value: "high", label: "Tinggi 20%", pct: 20 },
];
export const levelOf = (v: Level) => LEVELS.find((l) => l.value === v) ?? LEVELS[0];

export const PPN_PCT = 11;
export const MAX_CAC_CADANGAN = 30; // CAC pengajuan sebelumnya di atas ini = tidak boleh minta cadangan
export const MAX_ALASAN = 240;

export type RawInput = {
  toko: string;
  adv: string;
  cap: string;
  start: string;
  eventOn: boolean;
  eventStart: string;
  eventEnd: string;
  cac: string;
  prevStart: string;
  prevEnd: string;
  prevBudget: string;
  prevOmset: string;
  level: Level;
  alasan: string;
};

export const EMPTY_INPUT: RawInput = {
  toko: "", adv: "", cap: "", start: "", eventOn: false, eventStart: "", eventEnd: "",
  cac: "", prevStart: "", prevEnd: "", prevBudget: "", prevOmset: "", level: "none", alasan: "",
};

// ---------- Tanggal (string "YYYY-MM-DD", tanpa zona waktu) ----------
const ymdOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const toYmd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => toYmd(new Date(toDate(s).getTime() + n * 86400000));
export const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
const dowMon0 = (s: string) => (toDate(s).getUTCDay() + 6) % 7; // Senin = 0
export const sundayOf = (s: string) => addDays(s, 6 - dowMon0(s));

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const tglPendek = (s: string) => `${toDate(s).getUTCDate()} ${BULAN[toDate(s).getUTCMonth()]}`;
export const hariTgl = (s: string) => `${HARI[dowMon0(s)]} ${tglPendek(s)}`;
export const hariNama = (s: string) => HARI[dowMon0(s)];

// ---------- Format ----------
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
export const rp = (n: number) => `Rp${nf.format(Math.round(n))}`;
export const pct = (n: number) => `${nf1.format(n)}%`;

// ---------- Pemeriksaan isian ----------
export type Parsed = {
  cap: number;
  start: string;
  end: string;
  days: number;
  cac: number;
  event: { start: string; end: string; days: number } | null;
};

export type Cek = {
  errors: Partial<Record<keyof RawInput, string>>;
  missing: string[]; // nama isian wajib yang belum lengkap/valid (untuk daftar di bawah tombol salin)
  core: Parsed | null; // terisi bila cukup untuk dihitung
  prevBudget: number | null;
  prevOmset: number | null;
  prevCac: number | null;
  locked: boolean; // CAC sebelumnya > 30% => cadangan dikunci
  eventMin: string; // batas kalender event
  eventMax: string;
};

const positif = (s: string) => {
  const n = parseNumber(s);
  return n !== null && Number.isFinite(n) && n > 0 ? n : null;
};

export function cekInput(r: RawInput): Cek {
  const errors: Cek["errors"] = {};
  const missing: string[] = [];

  if (!r.adv.trim()) missing.push("nama ADV");
  if (!r.toko.trim()) missing.push("toko");

  const cap = positif(r.cap);
  if (cap === null) {
    missing.push("cap harian");
    if (r.cap.trim()) errors.cap = "Isi dengan angka lebih dari 0, contoh: 150.000";
  }

  let start = "";
  let end = "";
  let days = 0;
  if (ymdOk(r.start)) {
    start = r.start;
    end = sundayOf(start);
    days = diffDays(start, end) + 1;
  } else missing.push("tanggal mulai budget");

  const cacN = parseNumber(r.cac);
  let cac: number | null = null;
  if (cacN !== null && Number.isFinite(cacN) && cacN > 0 && cacN <= 100) cac = cacN;
  else {
    missing.push("target CAC pribadi");
    if (r.cac.trim()) errors.cac = "Isi persen antara 1 dan 100, contoh: 25";
  }

  // Event: tanggal mulai & selesai harus di dalam periode budget
  let event: Parsed["event"] = null;
  if (r.eventOn) {
    let ok = true;
    if (!ymdOk(r.eventStart)) { ok = false; missing.push("tanggal mulai event"); }
    else if (start && (r.eventStart < start || r.eventStart > end)) { ok = false; errors.eventStart = "Tanggal mulai event harus di dalam periode budget."; missing.push("tanggal mulai event"); }
    if (!ymdOk(r.eventEnd)) { ok = false; missing.push("tanggal selesai event"); }
    else if (start && (r.eventEnd < start || r.eventEnd > end)) { ok = false; errors.eventEnd = "Tanggal selesai event harus di dalam periode budget."; missing.push("tanggal selesai event"); }
    else if (ymdOk(r.eventStart) && r.eventEnd < r.eventStart) { ok = false; errors.eventEnd = "Tanggal selesai event tidak boleh sebelum tanggal mulai."; missing.push("tanggal selesai event"); }
    if (ok) event = { start: r.eventStart, end: r.eventEnd, days: diffDays(r.eventStart, r.eventEnd) + 1 };
  }

  // Pengajuan sebelumnya
  const prevBudget = positif(r.prevBudget);
  if (prevBudget === null) { missing.push("budget pengajuan sebelumnya"); if (r.prevBudget.trim()) errors.prevBudget = "Isi dengan angka lebih dari 0"; }
  const prevOmset = positif(r.prevOmset);
  if (prevOmset === null) { missing.push("omset pengajuan sebelumnya"); if (r.prevOmset.trim()) errors.prevOmset = "Isi dengan angka lebih dari 0"; }
  if (!ymdOk(r.prevStart)) missing.push("tanggal mulai pengajuan sebelumnya");
  else if (start && r.prevStart >= start) { errors.prevStart = "Tanggal pengajuan sebelumnya harus sebelum tanggal mulai budget yang diajukan."; missing.push("tanggal mulai pengajuan sebelumnya"); }
  if (!ymdOk(r.prevEnd)) missing.push("tanggal selesai pengajuan sebelumnya");
  else if (ymdOk(r.prevStart) && r.prevEnd <= r.prevStart) { errors.prevEnd = "Tanggal selesai harus setelah tanggal mulai."; missing.push("tanggal selesai pengajuan sebelumnya"); }
  else if (start && r.prevEnd >= start) { errors.prevEnd = "Tanggal pengajuan sebelumnya harus sebelum tanggal mulai budget yang diajukan."; missing.push("tanggal selesai pengajuan sebelumnya"); }

  const prevCac = prevBudget && prevOmset ? (prevBudget / prevOmset) * 100 : null;
  const locked = prevCac !== null && prevCac > MAX_CAC_CADANGAN;

  const level: Level = locked ? "none" : r.level;
  if (level !== "none" && !r.alasan.trim()) missing.push("pertimbangan cadangan");

  const core: Parsed | null =
    cap !== null && start && cac !== null && (!r.eventOn || event)
      ? { cap, start, end, days, cac, event }
      : null;

  return {
    errors,
    missing,
    core,
    prevBudget,
    prevOmset,
    prevCac,
    locked,
    eventMin: start,
    eventMax: end,
  };
}

// Saran level cadangan bila ada event (hanya saran, pilihan tidak berubah sendiri)
export function saranLevel(eventDays: number): { level: Level; text: string } {
  return eventDays >= 3
    ? { level: "high", text: `Ada event ${eventDays} hari: disarankan cadangan Tinggi (20%).` }
    : { level: "mid", text: `Ada event ${eventDays} hari: disarankan cadangan Sedang (10%).` };
}

// ---------- Hasil hitungan (dari server) ----------
export type Hasil = {
  budget: number;
  rataPerHari: number;
  hari: { tanggal: string; budget: number; ppn: number }[];
  capEvent: number | null;
  targetOmset: number;
  level: Level;
  cadanganPct: number;
  cadangan: number;
  totalNetto: number;
  kas: number;
  omsetMin: number;
  omsetMinCadangan: number;
};

export function teksWhatsApp(r: RawInput, c: Cek, h: Hasil): string {
  const p = c.core!;
  const L: string[] = [];
  L.push(`*Pengajuan Budget Iklan — ${r.toko.trim()}*`);
  L.push(`ADV: ${r.adv.trim()}`);
  L.push(`Periode: ${hariTgl(p.start)} – ${hariTgl(p.end)} (${p.days} hari)`);
  if (p.event && h.capEvent) L.push(`Spesial event: ${p.event.days} hari (cap event ${rp(h.capEvent)}/hari)`);
  L.push(
    `Pengajuan sebelumnya (${tglPendek(r.prevStart)} – ${tglPendek(r.prevEnd)}): budget ${rp(c.prevBudget!)}, omset ${rp(c.prevOmset!)}, CAC rata-rata ${pct(c.prevCac!)}`,
  );
  L.push(`Target omset: ${rp(h.targetOmset)} (otomatis dari cap ÷ CAC)`);
  L.push(`Target CAC pribadi: ${pct(p.cac)}`);
  L.push(`Cap harian: ${rp(p.cap)}`);
  L.push(`Budget iklan: ${rp(h.budget)} (± ${rp(h.rataPerHari)}/hari)`);
  if (h.level !== "none") L.push(`Dana cadangan scale-up level ${levelOf(h.level).label}: ${rp(h.cadangan)}`);
  L.push(`*Total diajukan (netto): ${rp(h.totalNetto)}*`);
  L.push(`Kas top up + PPN ${PPN_PCT}%: ${rp(h.kas)}`);
  let k = `Kesimpulan: Dengan budget ${rp(h.budget)} dan target CAC pribadi ${pct(p.cac)}, harus mencetak omset minimal ${rp(h.omsetMin)}.`;
  if (h.level !== "none") k += ` Kalau cadangan ${rp(h.cadangan)} ikut terpakai, omset yang dicetak minimal ${rp(h.omsetMinCadangan)}.`;
  L.push(k);
  if (h.level !== "none") L.push(`Pertimbangan cadangan: ${r.alasan.trim()}`);
  return L.join("\n");
}
