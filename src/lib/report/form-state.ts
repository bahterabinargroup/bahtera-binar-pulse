// Isian form di browser (FormState) <-> kolom daily_reports (ReportData).
// Semua nilai di form disimpan sebagai teks; angka diubah menjadi number saat
// disimpan agar mudah dianalisis.

import {
  allBlocks,
  type Column,
  type FieldType,
  type FormTemplate,
  type LabelColumn,
  type TableBlock,
} from "./template";

export type Row = Record<string, string>;

export type FormState = {
  header: Record<string, string>;
  activities: Row[];
  checklists: Record<string, { value: string; note: string }>;
  tables: Record<string, Row[]>;
  matrices: Record<string, Row[]>; // satu baris per entitas (Toko 1, Toko 2), berisi "nama" + metrik
  labels: Record<LabelColumn, string>;
  evidence: string[];
};

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// Kolom daily_reports yang boleh diisi aplikasi.
export type ReportData = {
  activities: Record<string, Json>[];
  performance_metrics: Record<string, Json>;
  insights: string | null;
  obstacles: string | null;
  next_plan: string | null;
  evidence_links: string[];
};

export const MAX_EVIDENCE = 20;

// Isian yang biasanya sama setiap hari (Toko, Mentor, ADV/Tim, nama toko per kolom),
// diambil dari laporan sebelumnya agar tidak perlu diketik ulang.
export type Prefill = { header: Record<string, string>; matrixNames: Record<string, string[]> };

export function extractPrefill(template: FormTemplate, metrics: unknown): Prefill {
  const m = (metrics ?? {}) as Record<string, unknown>;
  const prefill: Prefill = { header: {}, matrixNames: {} };
  for (const f of template.header_fields) {
    const v = toText(m[f.key]).trim();
    if (v) prefill.header[f.key] = v;
  }
  for (const b of allBlocks(template)) {
    if (b.type !== "matrix") continue;
    const names = toRows(m[b.key]).map((r) => (r.nama ?? "").trim());
    if (names.some(Boolean)) prefill.matrixNames[b.key] = names;
  }
  return prefill;
}

// Pilihan Status yang berarti "belum dikerjakan": tampil merah dan dihitung
// "Belum lengkap", tetapi laporan tetap boleh disimpan (keputusan pemilik 6 Okt).
export const NEGATIVE_STATUS = ["Belum"];

const emptyRow = (columns: Column[]): Row =>
  Object.fromEntries(columns.filter((c) => c.type !== "fixed_text").map((c) => [c.key, ""]));

function tableRows(block: TableBlock, saved: Row[] = []): Row[] {
  if (block.fixed_rows?.length) {
    // Baris tetap: urutan mengikuti template, isian dicocokkan per posisi.
    return block.fixed_rows.map((fixed, i) => ({ ...emptyRow(block.columns), ...saved[i], ...fixed }));
  }
  return padRows(saved, block.initial_rows ?? 1, block.columns);
}

function padRows(rows: Row[], min: number, columns: Column[]): Row[] {
  const out = rows.map((r) => ({ ...emptyRow(columns), ...r }));
  while (out.length < min) out.push(emptyRow(columns));
  return out;
}

const toText = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

function toRows(v: unknown): Row[] {
  if (!Array.isArray(v)) return [];
  return v.map((r) =>
    Object.fromEntries(Object.entries((r ?? {}) as Record<string, unknown>).map(([k, x]) => [k, toText(x)])),
  );
}

// Form kosong (laporan baru) atau terisi dari laporan yang sudah tersimpan.
export function buildFormState(
  template: FormTemplate,
  saved?: Partial<ReportData> | null,
  prefill?: Prefill | null,
): FormState {
  const m = (saved?.performance_metrics ?? {}) as Record<string, unknown>;
  const state: FormState = {
    header: {},
    activities: [],
    checklists: {},
    tables: {},
    matrices: {},
    labels: {
      insights: saved?.insights ?? "",
      obstacles: saved?.obstacles ?? "",
      next_plan: saved?.next_plan ?? "",
    },
    evidence: [...(saved?.evidence_links ?? [])],
  };

  for (const f of template.header_fields) state.header[f.key] = toText(m[f.key]) || (prefill?.header[f.key] ?? "");

  for (const b of allBlocks(template)) {
    switch (b.type) {
      case "activities":
        state.activities = padRows(toRows(saved?.activities), b.initial_rows ?? 1, b.columns);
        break;
      case "checklist":
        for (const item of b.items) {
          const v = (m[item.key] ?? {}) as { value?: unknown; note?: unknown };
          state.checklists[item.key] = { value: toText(v.value), note: toText(v.note) };
        }
        break;
      case "table":
        state.tables[b.key] = tableRows(b, toRows(m[b.key]));
        break;
      case "matrix": {
        const rows = toRows(m[b.key]);
        const count = Math.max(b.initial_entities ?? 1, rows.length);
        const cols = [{ key: "nama" }, ...b.rows].map((r) => ({ key: r.key, label: "", type: "text" as FieldType }));
        state.matrices[b.key] = padRows(rows, count, cols).map((r, i) => ({
          ...r,
          nama: r.nama || (prefill?.matrixNames[b.key]?.[i] ?? ""),
        }));
        break;
      }
      case "evidence":
        if (state.evidence.length === 0) state.evidence = [""];
        break;
    }
  }
  return state;
}

// ---------- Validasi ----------

// Angka gaya Indonesia: "1.500.000", "Rp 1.500.000", "12,5", "12".
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
  if (s === "") return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

// Link boleh ditulis tanpa "https://", misalnya bit.ly/abc.
export function normalizeUrl(input: string): string | null {
  const s = input.trim();
  if (s === "") return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".") || /\s/.test(s)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Beberapa link sekaligus: satu per baris (atau dipisah spasi). Semua harus valid; hasilnya satu per baris.
export function splitLinks(input: string): string[] {
  return input.split(/\s+/).filter(Boolean);
}

export function normalizeLinks(input: string): string | null {
  const tokens = splitLinks(input);
  if (tokens.length === 0) return "";
  const out: string[] = [];
  for (const t of tokens) {
    const u = normalizeUrl(t);
    if (!u) return null;
    out.push(u);
  }
  return out.join("\n");
}

export const ERR_NUMBER = "Harus berupa angka, contoh: 1500000 atau 1.500.000";
export const ERR_URL = "Link tidak valid. Contoh: https://drive.google.com/...";

export type Errors = Record<string, string>;

function checkValue(type: FieldType | "url" | "text" | undefined, value: string): string | null {
  if (!value.trim()) return null;
  if (type === "number" && Number.isNaN(parseNumber(value))) return ERR_NUMBER;
  if (type === "url" && normalizeLinks(value) === null) return ERR_URL;
  return null;
}

// Kesalahan format (angka/link). Kesalahan ini menghalangi penyimpanan.
export function validate(template: FormTemplate, s: FormState): Errors {
  const errors: Errors = {};
  const put = (path: string, type: FieldType | "url" | "text" | undefined, value: string) => {
    const e = checkValue(type, value);
    if (e) errors[path] = e;
  };

  for (const f of template.header_fields) put(`header.${f.key}`, f.type, s.header[f.key] ?? "");

  for (const b of allBlocks(template)) {
    switch (b.type) {
      case "activities":
        s.activities.forEach((r, i) => b.columns.forEach((c) => put(`activities.${i}.${c.key}`, c.type, r[c.key] ?? "")));
        break;
      case "checklist":
        for (const item of b.items) {
          const v = s.checklists[item.key];
          if (item.kind === "number") put(`checklists.${item.key}.value`, "number", v.value);
          if (item.note.mode === "input") put(`checklists.${item.key}.note`, item.note.type, v.note);
        }
        break;
      case "table":
        s.tables[b.key].forEach((r, i) =>
          b.columns.forEach((c) => put(`tables.${b.key}.${i}.${c.key}`, c.type, r[c.key] ?? "")),
        );
        break;
      case "matrix":
        s.matrices[b.key].forEach((r, i) =>
          b.rows.forEach((row) => put(`matrices.${b.key}.${i}.${row.key}`, row.type, r[row.key] ?? "")),
        );
        break;
      case "evidence":
        s.evidence.forEach((v, i) => {
          // Bukti umum: satu link per kolom (tombol + Tambah link untuk menambah)
          if (v.trim() && normalizeUrl(v) === null) errors[`evidence.${i}`] = ERR_URL;
        });
        if (s.evidence.filter((v) => v.trim()).length > MAX_EVIDENCE) {
          errors["evidence"] = `Maksimal ${MAX_EVIDENCE} link bukti.`;
        }
        break;
    }
  }
  return errors;
}

// Isian wajib yang masih kosong. Hanya penanda "Belum lengkap", tidak menghalangi simpan.
export function missingRequired(template: FormTemplate, s: FormState): Set<string> {
  const missing = new Set<string>();
  for (const f of template.header_fields) {
    if (f.required && !s.header[f.key]?.trim()) missing.add(`header.${f.key}`);
  }
  for (const b of allBlocks(template)) {
    if (b.type === "checklist") {
      for (const item of b.items) {
        const value = s.checklists[item.key]?.value.trim() ?? "";
        if (item.required && (!value || (item.kind === "status" && NEGATIVE_STATUS.includes(value)))) {
          missing.add(`checklists.${item.key}.value`);
        }
      }
    }
    if (b.type === "matrix") {
      s.matrices[b.key].forEach((entity, i) => {
        // Toko pertama selalu wajib; toko berikutnya wajib jika mulai diisi.
        const used = i === 0 || Object.values(entity).some((v) => v.trim());
        if (!used) return;
        // Nama toko wajib agar data per toko jelas (keputusan pemilik 6 Okt).
        if (!entity.nama?.trim()) missing.add(`matrices.${b.key}.${i}.nama`);
        for (const row of b.rows) {
          if (row.required && !entity[row.key]?.trim()) missing.add(`matrices.${b.key}.${i}.${row.key}`);
        }
      });
    }
  }
  return missing;
}

// ---------- Konversi ke kolom database ----------

function convert(type: FieldType | "url" | "text" | undefined, value: string): Json {
  const v = value.trim();
  if (v === "") return null;
  if (type === "number") return parseNumber(v);
  if (type === "url") return normalizeLinks(v);
  return v;
}

const rowIsEmpty = (r: Row, columns: { key: string; type: FieldType }[]) =>
  columns.every((c) => c.type === "fixed_text" || !(r[c.key] ?? "").trim());

function convertRow(r: Row, columns: { key: string; type: FieldType }[]): Record<string, Json> {
  return Object.fromEntries(
    columns.map((c) => [c.key, c.type === "fixed_text" ? (r[c.key] ?? "") : convert(c.type, r[c.key] ?? "")]),
  );
}

// Panggil hanya jika validate() kosong.
export function toReportData(template: FormTemplate, s: FormState): ReportData {
  const metrics: Record<string, Json> = {};
  let activities: Record<string, Json>[] = [];

  for (const f of template.header_fields) metrics[f.key] = convert(f.type, s.header[f.key] ?? "");

  for (const b of allBlocks(template)) {
    switch (b.type) {
      case "activities":
        activities = s.activities.filter((r) => !rowIsEmpty(r, b.columns)).map((r) => convertRow(r, b.columns));
        break;
      case "checklist":
        for (const item of b.items) {
          const v = s.checklists[item.key];
          metrics[item.key] = {
            value: convert(item.kind === "number" ? "number" : "text", v.value),
            note: item.note.mode === "input" ? convert(item.note.type, v.note) : null,
          };
        }
        break;
      case "table": {
        const rows = b.fixed_rows?.length
          ? s.tables[b.key] // baris tetap selalu disimpan agar urutannya terjaga
          : s.tables[b.key].filter((r) => !rowIsEmpty(r, b.columns));
        metrics[b.key] = rows.map((r) => convertRow(r, b.columns));
        break;
      }
      case "matrix": {
        const cols = [{ key: "nama", type: "text" as FieldType }, ...b.rows];
        metrics[b.key] = s.matrices[b.key].map((r) => convertRow(r, cols));
        break;
      }
    }
  }

  const label = (v: string) => (v.trim() ? v.trim() : null);
  return {
    activities,
    performance_metrics: metrics,
    insights: label(s.labels.insights),
    obstacles: label(s.labels.obstacles),
    next_plan: label(s.labels.next_plan),
    evidence_links: s.evidence.map((v) => normalizeUrl(v)).filter((v): v is string => !!v),
  };
}
