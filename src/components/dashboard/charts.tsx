// Grafik sederhana berbasis SVG/CSS (tanpa pustaka luar), berwarna sesuai brand.

export const COLORS = {
  navy: "#012C4E",
  gold: "#C4A251",
  navy2: "#31596F",
  gold2: "#E0CB8A",
  blue: "#7A9BB5",
  grey: "#B9C6D3",
};
const PALETTE = [COLORS.navy, COLORS.gold, COLORS.navy2, COLORS.gold2, COLORS.blue, COLORS.grey];

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

export type Series = { name: string; color: string; values: (number | null)[]; dashed?: boolean };

export function LineChart({
  labels,
  series,
  yMax,
  fmtY,
  fmtTip,
}: {
  labels: string[];
  series: Series[];
  yMax?: number;
  fmtY: (n: number) => string;
  fmtTip?: (n: number) => string;
}) {
  const W = 480, H = 200, L = 58, R = 14, T = 12, B = 28;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = yMax ?? niceMax(Math.max(...all, 0));
  const n = labels.length;
  const x = (i: number) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const step = Math.max(1, Math.ceil(n / 6));
  const tip = fmtTip ?? fmtY;

  const pathFor = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.name).join(", ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e4e4e7" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#71717a">{fmtY(t)}</text>
          </g>
        ))}
        {labels.map((lb, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={lb + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#71717a">{lb}</text>
          ) : null,
        )}
        {series.map((s) => (
          <g key={s.name}>
            <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
            {s.values.map((v, i) =>
              v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={n > 20 ? 2 : 3.2} fill={s.color}>
                  <title>{`${s.name} · ${labels[i]}: ${tip(v)}`}</title>
                </circle>
              ),
            )}
          </g>
        ))}
      </svg>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

// Batang mendatar: label, bar, nilai.
export function BarList({
  items,
  max,
  color = COLORS.navy,
}: {
  items: { label: string; value: number; display: string; note?: string }[];
  max?: number;
  color?: string;
}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-bold text-zinc-800" title={i.label}>{i.label}</span>
            <span className="shrink-0 text-zinc-700">{i.display}</span>
          </div>
          <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, (i.value / top) * 100))}%`, background: color }} />
          </div>
          {i.note && <p className="mt-0.5 text-xs text-zinc-500">{i.note}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Donut({ items, center, fmt }: { items: { label: string; value: number }[]; center?: string; fmt: (n: number) => string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = 40, C = 2 * Math.PI * r;
  const arcs = items.reduce<{ label: string; value: number; len: number; start: number }[]>((acc, it) => {
    const len = (it.value / total) * C;
    const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0;
    return [...acc, { label: it.label, value: it.value, len, start }];
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label="Porsi">
        <g transform="rotate(-90 60 60)">
          {arcs.map((a, idx) => (
            <circle key={a.label} cx="60" cy="60" r={r} fill="none" stroke={PALETTE[idx % PALETTE.length]} strokeWidth="18" strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.start}>
              <title>{`${a.label}: ${fmt(a.value)} (${((a.value / total) * 100).toFixed(1)}%)`}</title>
            </circle>
          ))}
        </g>
        {center && <text x="60" y="64" textAnchor="middle" fontSize="12" fontWeight="700" fill={COLORS.navy}>{center}</text>}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-sm">
        {items.map((it, idx) => (
          <li key={it.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[idx % PALETTE.length] }} />
              <span className="truncate" title={it.label}>{it.label}</span>
            </span>
            <span className="shrink-0 text-zinc-600">{((it.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Deretan kotak per hari: hijau = sudah lapor, merah = belum, abu = bukan hari kerja.
export function DayStrip({ days }: { days: { day: string; label: string; state: "ok" | "miss" | "off" }[] }) {
  const cls = { ok: "bg-green-500 text-white", miss: "bg-red-200 text-red-900", off: "bg-zinc-100 text-zinc-400" } as const;
  const word = { ok: "sudah melapor", miss: "belum melapor", off: "bukan hari kerja" } as const;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {days.map((d) => (
        <li key={d.day} title={`${d.day}: ${word[d.state]}`} className={`flex h-9 w-9 flex-col items-center justify-center rounded-md text-[10px] font-bold ${cls[d.state]}`}>
          <span>{d.label}</span>
          <span aria-hidden="true">{d.state === "ok" ? "✓" : d.state === "miss" ? "–" : ""}</span>
        </li>
      ))}
    </ul>
  );
}
