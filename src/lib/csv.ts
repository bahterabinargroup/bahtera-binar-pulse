// CSV: pemisah koma, UTF-8 dengan BOM (terbaca benar di Excel). Sel yang diawali = + - @ diberi tanda ' agar tidak dibaca sebagai rumus.
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvBody = (header: string[], rows: unknown[][]) => "﻿" + [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
