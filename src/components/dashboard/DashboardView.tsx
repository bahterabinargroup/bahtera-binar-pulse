import Link from "next/link";
import { fmtInt, fmtPct, fmtRp, fmtRpFull } from "@/lib/format";
import { cacPct, PERIODE_LABEL, roas, type AdvAgg, type DayCompliance, type GroupCompliance, type Periode } from "@/lib/dashboard";
import type { TargetProgress } from "@/lib/target";
import { BarList, COLORS, DayStrip, Donut, LineChart } from "./charts";

export type DashboardData = {
  scope: "tim" | "saya";
  periode: Periode;
  range: { from: string; to: string };
  companyName: string;
  compliance: { days: DayCompliance[]; total: { expected: number; filled: number; pct: number | null } };
  today: { filled: number; expected: number } | null;
  byPosition: GroupCompliance[];
  presence: { sudah: number; total: number };
  adv: AdvAgg | null;
  target: { monthLabel: string; progress: TargetProgress; advCount: number; perAdv: { name: string; actual: number; target: number; pct: number }[] } | null;
  kendala: number;
  overdue: number;
  myDays?: { day: string; label: string; state: "ok" | "miss" | "off" }[];
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

type IconName = "orang" | "centang" | "uang" | "persen" | "tanda" | "jam";

function Icon({ name }: { name: IconName }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" className="hidden h-9 w-9 shrink-0 opacity-70 sm:block" aria-hidden="true">
      {name === "orang" && (<><circle cx="12" cy="8" r="3.5" {...p} /><path d="M5 20c0-3.8 3.1-6 7-6s7 2.2 7 6" {...p} /></>)}
      {name === "centang" && (<><circle cx="12" cy="12" r="9" {...p} /><path d="M8 12.5l2.8 2.8L16.5 9.5" {...p} /></>)}
      {name === "uang" && (<><rect x="3" y="6.5" width="18" height="11" rx="2" {...p} /><circle cx="12" cy="12" r="2.6" {...p} /></>)}
      {name === "persen" && (<><path d="M5 19L19 5" {...p} /><circle cx="7" cy="7" r="2.3" {...p} /><circle cx="17" cy="17" r="2.3" {...p} /></>)}
      {name === "tanda" && (<><path d="M12 3.5L21.5 20h-19L12 3.5z" {...p} /><path d="M12 10v4.5M12 17.5v.1" {...p} /></>)}
      {name === "jam" && (<><circle cx="12" cy="12" r="9" {...p} /><path d="M12 7v5l3.2 2" {...p} /></>)}
    </svg>
  );
}

function Tile({ i, icon, value, label, sub, title }: { i: number; icon: IconName; value: string; label: string; sub?: string; title?: string }) {
  const s = TILE_STYLE[i % TILE_STYLE.length];
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-sm" style={{ background: s.bg, color: s.fg }} title={title}>
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

export function DashboardView({ d, filter, canSetTarget = false }: { d: DashboardData; filter?: React.ReactNode; canSetTarget?: boolean }) {
  const tim = d.scope === "tim";
  const adv = d.adv && d.adv.reports > 0 ? d.adv : null;
  const money = adv?.hasMoney ? adv : null;
  const cac = money ? cacPct(money.total.ads, money.total.gmv) : null;
  const rs = money ? roas(money.total.ads, money.total.gmv) : null;
  const pct = d.compliance.total.pct;
  const periodeText = `${PERIODE_LABEL[d.periode]}${d.periode !== "hari" ? ` (${shortDay(d.range.from)} – ${shortDay(d.range.to)})` : ""}`;

  const tiles: { icon: IconName; value: string; label: string; sub?: string; title?: string }[] = [];
  if (tim && d.today) tiles.push({ icon: "orang", value: `${d.today.filled}/${d.today.expected}`, label: "Laporan masuk hari ini", sub: "orang sudah melapor" });
  if (!tim) tiles.push({ icon: "orang", value: `${d.compliance.total.filled}/${d.compliance.total.expected}`, label: "Hari kerja terisi", sub: periodeText });
  tiles.push({ icon: "centang", value: pct === null ? "—" : fmtPct(pct, 0), label: tim ? "Kepatuhan pengisian" : "Kepatuhan saya", sub: periodeText });
  const tg = d.target?.progress ?? null;
  if (tg) {
    tiles.push({
      icon: "uang",
      value: fmtRp(tg.todayActual),
      label: "Omzet hari ini",
      sub: tg.todayPct === null ? "Hari libur, tanpa target harian" : `${fmtPct(tg.todayPct, 0)} dari target harian ${fmtRp(tg.dailyTarget ?? 0)}`,
      title: fmtRpFull(tg.todayActual),
    });
    tiles.push({
      icon: "centang",
      value: tg.mtdPct === null ? "—" : fmtPct(tg.mtdPct, 0),
      label: "Omzet bulan ini",
      sub: `${fmtRp(tg.mtdActual)} dari ${fmtRp(tg.monthlyTarget)}${tg.pacePct === null ? "" : ` · seharusnya ±${fmtPct(tg.pacePct, 0)}`}`,
      title: fmtRpFull(tg.mtdActual),
    });
  }
  if (money) {
    if (!tg) tiles.push({ icon: "uang", value: fmtRp(money.total.gmv), label: "GMV (ADV)", sub: `${fmtInt(money.total.pesanan)} pesanan`, title: fmtRpFull(money.total.gmv) });
    tiles.push({ icon: "persen", value: cac === null ? "—" : fmtPct(cac), label: "CAC (ads ÷ GMV)", sub: `Ads ${fmtRp(money.total.ads)}${rs ? ` · ROAS ${rs.toFixed(1).replace(".", ",")}` : ""}`, title: fmtRpFull(money.total.ads) });
  }
  tiles.push({ icon: "tanda", value: fmtInt(d.kendala), label: "Kendala ditulis", sub: periodeText });
  tiles.push({ icon: "jam", value: fmtInt(d.overdue), label: "Tugas lewat tenggat", sub: tim ? "dari notulensi" : "tugas saya" });

  const compDays = d.compliance.days;
  const hasComp = compDays.length > 0;

  return (
    <section aria-label="Ringkasan dashboard">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-accent">{tim ? "Dashboard" : "Ringkasan saya"}</h2>
          <p className="text-sm text-zinc-600">{tim ? d.companyName : "Angka dari laporan Anda sendiri"} · {periodeText}</p>
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
          {canSetTarget && !d.target && (
            <section className="rounded-xl border border-dashed border-gold bg-white/70 p-4 text-sm md:col-span-2">
              <p className="font-bold text-accent">Target omzet bulan ini belum ditetapkan</p>
              <p className="mt-1 text-zinc-600">
                Tetapkan target tiap ADV agar dashboard menampilkan persentase omzet hari ini dan bulan ini terhadap target.{" "}
                <Link href="/target" className="font-bold text-accent underline decoration-gold underline-offset-2">Atur target →</Link>
              </p>
            </section>
          )}

          {d.target && (
            <Card
              title={`Omzet bulan ini vs target (${d.target.monthLabel})`}
              sub={`Realisasi kumulatif (GMV form ADV) dibanding target kumulatif yang dibagi rata per hari kerja · ${d.target.advCount} ADV bertarget`}
              className={d.target.perAdv.length ? "" : "md:col-span-2"}
            >
              <LineChart
                labels={d.target.progress.series.map((x) => String(Number(x.day.slice(8))))}
                series={[
                  { name: "Realisasi", color: COLORS.navy, values: d.target.progress.series.map((x) => x.actual) },
                  { name: "Target (kumulatif)", color: COLORS.gold, values: d.target.progress.series.map((x) => x.target), dashed: true },
                ]}
                fmtY={(v) => fmtRp(v)}
                fmtTip={(v) => fmtRpFull(v)}
              />
            </Card>
          )}

          {d.target && d.target.perAdv.length > 0 && (
            <Card title="Pencapaian per ADV bulan ini" sub="Persen realisasi terhadap target bulanan masing-masing">
              <BarList
                max={Math.max(100, ...d.target.perAdv.map((a) => a.pct))}
                color={COLORS.navy2}
                items={d.target.perAdv.map((a) => ({
                  label: a.name,
                  value: a.pct,
                  display: fmtPct(a.pct, 0),
                  note: `${fmtRp(a.actual)} dari ${fmtRp(a.target)}`,
                }))}
              />
            </Card>
          )}

          {!tim && d.myDays && (
            <Card title="Riwayat pengisian laporan" sub="Hijau = sudah melapor, merah muda = belum, abu = bukan hari kerja" className="md:col-span-2">
              <DayStrip days={d.myDays} />
            </Card>
          )}

          {tim && (
            <Card title="Kepatuhan harian (%)" sub="Persen yang sudah melapor pada tiap hari kerja">
              {hasComp ? (
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
          )}

          {tim && (
            <Card title="Kepatuhan per divisi" sub="Rata-rata pada periode terpilih">
              {d.byPosition.length ? (
                <BarList
                  max={100}
                  items={d.byPosition.map((g) => ({ label: g.name, value: g.pct, display: fmtPct(g.pct, 0), note: `${g.filled} dari ${g.expected} laporan wajib` }))}
                />
              ) : (
                <Empty>Belum ada data pada periode ini.</Empty>
              )}
            </Card>
          )}

          <Card title="GMV dan biaya iklan harian" sub="Dari form ADV (per hari, semua toko)">
            {money ? (
              <LineChart
                labels={money.days.map((x) => shortDay(x.day))}
                series={[
                  { name: "GMV", color: COLORS.navy, values: money.days.map((x) => (x.n > 0 ? x.gmv : null)) },
                  { name: "Ads spent", color: COLORS.gold, values: money.days.map((x) => (x.n > 0 ? x.ads : null)) },
                ]}
                fmtY={(v) => fmtRp(v)}
                fmtTip={(v) => fmtRpFull(v)}
              />
            ) : (
              <Empty>Belum ada angka GMV atau ads spent dari form ADV pada periode ini.</Empty>
            )}
          </Card>

          <Card title="CAC harian (%)" sub="Ads spent ÷ GMV. Makin rendah makin hemat">
            {money && money.days.some((x) => cacPct(x.ads, x.gmv) !== null) ? (
              <LineChart
                labels={money.days.map((x) => shortDay(x.day))}
                series={[{ name: "CAC", color: COLORS.gold, values: money.days.map((x) => { const c = cacPct(x.ads, x.gmv); return c === null ? null : Math.round(c * 10) / 10; }) }]}
                fmtY={(v) => `${Math.round(v)}%`}
                fmtTip={(v) => `${v.toFixed(1)}%`}
              />
            ) : (
              <Empty>Belum cukup data untuk menghitung CAC.</Empty>
            )}
          </Card>

          {tim && (
            <Card title="Peringkat toko menurut GMV" sub="Nama toko dari kolom Toko 1/Toko 2 di form ADV">
              {money && money.toko.some((t) => t.gmv > 0) ? (
                <BarList
                  color={COLORS.navy}
                  items={money.toko.filter((t) => t.gmv > 0).slice(0, 8).map((t) => {
                    const c = cacPct(t.ads, t.gmv);
                    return { label: t.name, value: t.gmv, display: fmtRp(t.gmv), note: `${fmtInt(t.pesanan)} pesanan${c === null ? "" : ` · CAC ${fmtPct(c)}`}` };
                  })}
                />
              ) : (
                <Empty>Belum ada GMV per toko pada periode ini.</Empty>
              )}
            </Card>
          )}

          {tim && (
            <Card title="Porsi GMV per toko" sub="5 toko terbesar, sisanya digabung">
              {money && money.toko.filter((t) => t.gmv > 0).length >= 2 ? (
                (() => {
                  const sorted = money.toko.filter((t) => t.gmv > 0);
                  const top = sorted.slice(0, 5).map((t) => ({ label: t.name, value: t.gmv }));
                  const rest = sorted.slice(5).reduce((s, t) => s + t.gmv, 0);
                  return <Donut items={rest > 0 ? [...top, { label: "Lainnya", value: rest }] : top} fmt={fmtRp} center={`${sorted.length} toko`} />;
                })()
              ) : (
                <Empty>Perlu GMV dari minimal dua toko.</Empty>
              )}
            </Card>
          )}

          <Card title="Kerapian checklist harian ADV" sub="Persen laporan ADV yang berstatus Sudah">
            {adv ? (
              <BarList
                max={100}
                color={COLORS.navy2}
                items={adv.checklist.map((c) => ({ label: c.label, value: c.total ? (100 * c.sudah) / c.total : 0, display: fmtPct(c.total ? (100 * c.sudah) / c.total : 0, 0), note: `${c.sudah} dari ${c.total} laporan` }))}
              />
            ) : (
              <Empty>Belum ada laporan ADV pada periode ini.</Empty>
            )}
          </Card>

          <Card title="Presensi mandiri" sub="Persen laporan yang berstatus Sudah">
            {d.presence.total > 0 ? (
              <Donut
                items={[
                  { label: "Sudah", value: d.presence.sudah },
                  { label: "Belum", value: d.presence.total - d.presence.sudah },
                ]}
                fmt={(n) => `${n} laporan`}
                center={`${Math.round((100 * d.presence.sudah) / d.presence.total)}%`}
              />
            ) : (
              <Empty>Belum ada data presensi pada periode ini.</Empty>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        Angka berasal dari laporan harian di aplikasi ini. Omset dan target resmi mitra ada di spreadsheet{" "}
        <Link href="/#tautan" className="underline decoration-gold underline-offset-2">Dashboard Mitra (lihat Tautan penting)</Link>.
      </p>
    </section>
  );
}
