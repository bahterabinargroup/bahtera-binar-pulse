// Format angka untuk tampilan (bahasa Indonesia).

const nf = (digits: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const fmtInt = (n: number) => nf(0).format(Math.round(n));

// Rupiah ringkas: Rp 12,4 jt / Rp 1,25 M. Nilai penuh disediakan lewat fmtRpFull (untuk tooltip).
export function fmtRp(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}Rp ${nf(2).format(a / 1e12)} T`;
  if (a >= 1e9) return `${sign}Rp ${nf(2).format(a / 1e9)} M`;
  if (a >= 1e6) return `${sign}Rp ${nf(1).format(a / 1e6)} jt`;
  if (a >= 1e3) return `${sign}Rp ${nf(0).format(a / 1e3)} rb`;
  return `${sign}Rp ${nf(0).format(a)}`;
}

export const fmtRpFull = (n: number) => `Rp ${nf(0).format(Math.round(n))}`;

export const fmtPct = (n: number, digits = 1) => `${nf(digits).format(n)}%`;
