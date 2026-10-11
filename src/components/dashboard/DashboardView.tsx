import Link from "next/link";
import { fmtInt, fmtPct } from "@/lib/format";
import { PERIODE_LABEL, type DayCompliance, type GroupCompliance, type Periode } from "@/lib/dashboard";
import { BarList, COLORS, Donut, LineChart } from "./charts";

export type DashboardData = {
  periode: Periode;
  range: { from: string; to: string };
  companyName: string;
  compliance: { days: DayCompliance[]; total: { expected: number; filled: number; pct: number | null } };
  today: { filled: number; expected: number } | null;
  byPosition: GroupCompliance[];
  presensi: {
    days: DayCompliance[];
    total: { expected: number; filled: number; pct: number | null };
    today: { filled: number; expected: number; belumPulang: number } | null;
    byPosition: GroupCompliance[];
    status: { wfo: number; tugas_luar: number; izin: number; sakit: number };
  };
  kendala: number;
  overdue: number;
};

// ---------- kartu angka (kolom kiri) ----------

const TILE_STYLE = [
  { bg: "#F7F0DC", fg: COLORS.navy },
  { bg: "#EFE3BC", fg: COLORS.navy },
  { bg: "#E6D497", fg: COLORS.navy },
  { bg: COLORS.gold, fg: COLORS.navy },
  { bg: COLORS.navy2, fg: "#fff" },
  { bg: COLORS.navy, fg: "#fff" },
] as const;

type IconName = "orang" | "centang" | "persen" | "tanda" | "jam";

function Icon({ name }: { name: IconName }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" className="hidden h-9 w-9 shrink-0 opacity-70 sm:block" aria-hidden="true">
      {name === "orang" && (<><circle cx="12" cy="8" r="3.5" {...p} /><path d="M5 20c0-3.8 3.1-6 7-6s7 2.2 7 6" {...p} /></>)}
      {name === "centang" && (<><circle cx="12" cy="12" r="9" {...p} /><path d="M8 12.5l2.8 2.8L16.5 9.5" {...p} /></>)}
      {name === "persen" && (<><path d="M5 19L19 5" {...p} /><circle cx="7" cy="7" r="2.3" {...p} /><circle cx="17" cy="17" r="2.3" {...p} /></>)}
      {name === "tanda" && (<><path d="M12 3.5L21.5 20h-19L12 3.5z" {...p} /><path d="M12 10v4.5M12 17.5v.1" {...p} /></>)}
      {name === "jam" && (<><circle cx="12" cy="12" r="9" {...p} /><path d="M12 7v5l3.2 2" {...p} /></>)}
    </svg>
  );
}

function Tile({ i, icon, value, label, sub }: { i: number; icon: IconName; value: string; label: string; sub?: string }) {
  const s = TILE_STYLE[i % TILE_STYLE.length];
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-sm" style={{ background: s.bg, color: s.fg }}>
      <div className="min-w-0">
        <p className="text-xl leading-tight font-bold break-words sm:text-2xl">{value}</p>
        <p className="text-sm font-bold">{label}</p>
        {sub && <p className="text-xs opacity-80">{sub}</p>}
      </div>
      <Icon name={icon} />
    </div>
  );
}

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      <h3 className="rounded-t-xl border-b border-zinc-200 bg-[#F1ECDD] px-4 py-2 text-center text-sm font-bold text-accent">{title}</h3>
      <div className="p-4">
        {sub && <p className="mb-2 text-xs text-zinc-500">{sub}</p>}
        {children}
      </div>
    </section>
  );
}

const shortDay = (ymd: string) => `${Number(ymd.slice(8))}/${Number(ymd.slice(5, 7))}`;

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-zinc-500">{children}</p>;
}

export function DashboardView({ d, filter }: { d: DashboardData; filter?: React.ReactNode }) {
  const pct = d.compliance.total.pct;
  const pp = d.presensi;
  const periodeText = `${PERIODE_LABEL[d.periode]}${d.periode !== "hari" ? ` (${shortDay(d.range.from)} – ${shortDay(d.range.to)})` : ""}`;

  const tiles: { icon: IconName; value: string; label: string; sub?: string }[] = [];
  if (d.today) tiles.push({ icon: "orang", value: `${d.today.filled}/${d.today.expected}`, label: "Laporan masuk hari ini", sub: "orang sudah melapor" });
  tiles.push({ icon: "centang", value: pct === null ? "—" : fmtPct(pct, 0), label: "Kepatuhan laporan", sub: periodeText });
  if (pp.today) {
    tiles.push({
      icon: "jam",
      value: `${pp.today.filled}/${pp.today.expected}`,
      label: "Check-In hari ini",
      sub: pp.today.belumPulang > 0 ? `${pp.today.belumPulang} belum Check-Out` : "orang sudah Check-In",
    });
  }
  tiles.push({ icon: "persen", value: pp.total.pct === null ? "—" : fmtPct(pp.total.pct, 0), label: "Kehadiran (Check-In)", sub: periodeText });
  tiles.push({ icon: "tanda", value: fmtInt(d.kendala), label: "Kendala ditulis", sub: periodeText });
  tiles.push({ icon: "jam", value: fmtInt(d.overdue), label: "Tugas lewat tenggat", sub: "dari notulensi" });

  const compDays = d.compliance.days;
  const presDays = pp.days;
  const st = pp.status;
  const stTotal = st.wfo + st.tugas_luar + st.izin + st.sakit;

  return (
    <section aria-label="Ringkasan dashboard">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-accent">Dashboard</h2>
          <p className="text-sm text-zinc-600">{d.companyName} · {periodeText}</p>
        </div>
        {filter}
      </div>

      <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {tiles.map((t, idx) => (
            <Tile key={t.label} i={Math.round((idx * (TILE_STYLE.length - 1)) / Math.max(1, tiles.length - 1))} {...t} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Kepatuhan laporan harian (%)" sub="Persen yang sudah melapor pada tiap hari kerja">
            {compDays.length > 0 ? (
              <LineChart
                labels={compDays.map((x) => shortDay(x.day))}
                series={[{ name: "Kepatuhan", color: COLORS.navy, values: compDays.map((x) => Math.round(x.pct * 10) / 10) }]}
                yMax={100}
                fmtY={(v) => `${Math.round(v)}%`}
                fmtTip={(v) => `${v.toFixed(0)}%`}
              />
            ) : (
              <Empty>Belum ada data pada periode ini.</Empty>
            )}
          </Card>

          <Card title="Kepatuhan laporan per divisi" sub="Rata-rata pada periode terpilih">
            {d.byPosition.length ? (
              <BarList max={100} items={d.byPosition.map((g) => ({ label: g.name, value: g.pct, display: fmtPct(g.pct, 0), note: `${g.filled} dari ${g.expected} laporan wajib` }))} />
            ) : (
              <Empty>Belum ada data pada periode ini.</Empty>
            )}
          </Card>

          <Card title="Kehadiran harian (%)" sub="Persen yang sudah Check-In pada tiap hari kerja">
            {presDays.length > 0 && pp.total.filled > 0 ? (
              <LineChart
                labels={presDays.map((x) => shortDay(x.day))}
                series={[{ name: "Check-In", color: COLORS.gold, values: presDays.map((x) => Math.round(x.pct * 10) / 10) }]}
                yMax={100}
                fmtY={(v) => `${Math.round(v)}%`}
                fmtTip={(v) => `${v.toFixed(0)}%`}
              />
            ) : (
              <Empty>Belum ada presensi pada periode ini.</Empty>
            )}
          </Card>

          <Card title="Kehadiran per divisi" sub="Persen hari kerja yang ada Check-In">
            {pp.byPosition.length && pp.total.filled > 0 ? (
              <BarList max={100} color={COLORS.navy2} items={pp.byPosition.map((g) => ({ label: g.name, value: g.pct, display: fmtPct(g.pct, 0), note: `${g.filled} dari ${g.expected} hari wajib` }))} />
            ) : (
              <Empty>Belum ada presensi pada periode ini.</Empty>
            )}
          </Card>

          <Card title="Komposisi status presensi" sub="Jumlah Check-In pada periode terpilih" className="md:col-span-2">
            {stTotal > 0 ? (
              <Donut
                items={[
                  { label: "WFO", value: st.wfo },
                  { label: "Tugas Luar", value: st.tugas_luar },
                  { label: "Izin", value: st.izin },
                  { label: "Sakit", value: st.sakit },
                ].filter((x) => x.value > 0)}
                fmt={(n) => `${n} presensi`}
                center={`${stTotal}`}
              />
            ) : (
              <Empty>Belum ada presensi pada periode ini.</Empty>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        Angka berasal dari laporan harian dan presensi di aplikasi ini (data yang diisi semua divisi). Detail per orang ada di{" "}
        <Link href="/dashboard" className="underline decoration-gold underline-offset-2">Dashboard Tim</Link> dan{" "}
        <Link href="/presensi/rekap" className="underline decoration-gold underline-offset-2">Rekap Presensi</Link>.
      </p>
    </section>
  );
}
