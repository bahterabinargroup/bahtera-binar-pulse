import Link from "next/link";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { addDays, formatTanggalPendek, mondayOf, todayJakarta } from "@/lib/date";
import { requireOwnerPage } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { loadMeetings, type MeetingExportRow } from "@/lib/meeting-export";
import { isMonth, loadRange, loadWeekly, monthLabel, monthRange, shiftMonth, type WeeklyRow } from "@/lib/weekly";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function OwnerTarikanPage({ searchParams }: PageProps<"/owner/tarikan">) {
  await requireOwnerPage();
  const sp = await searchParams;
  const today = todayJakarta();
  const jenis = one(sp.jenis) === "notulensi" ? "notulensi" : "laporan";
  const mode = one(sp.mode) === "bulan" ? "bulan" : "minggu";
  const picked = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.minggu)) ? one(sp.minggu) : today;
  const week = mondayOf(picked);
  const month = isMonth(one(sp.bulan)) ? one(sp.bulan) : today.slice(0, 7);
  const company = one(sp.company);
  // Pilihan bulan: 24 bulan terakhir (terbaru dulu).
  const months = Array.from({ length: 24 }, (_, i) => shiftMonth(today.slice(0, 7), -i));
  if (!months.includes(month)) months.push(month);

  const supabase = await createClient();
  const range = monthRange(month);
  const start = mode === "bulan" ? range.start : week;
  const end = mode === "bulan" ? range.end : addDays(week, 6);
  const [rows, comp] = await Promise.all([
    jenis === "notulensi"
      ? loadMeetings(start, end, company || null)
      : mode === "bulan"
        ? loadRange(range.start, range.end, company || null)
        : loadWeekly(week, company || null),
    supabase.from("companies").select("id, name").order("name"),
  ]);
  if (comp.error) throw new Error(comp.error.message);

  const qs = (extra: Record<string, string>) => {
    const base: Record<string, string> = mode === "bulan" ? { mode, bulan: month } : { minggu: week };
    const p = new URLSearchParams({ jenis: jenis === "notulensi" ? jenis : "", ...base, company, ...extra });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return p.toString();
  };
  const tab = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-accent text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`;
  const companyQ = company ? `&company=${company}` : "";
  const jenisQ = jenis === "notulensi" ? "&jenis=notulensi" : "";
  const periodQ = mode === "bulan" ? `mode=bulan&bulan=${month}` : `minggu=${week}`;
  const unit = jenis === "notulensi" ? "notulensi" : "laporan";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tarikan Laporan</h1>
      <p className="text-sm text-zinc-600">
        Laporan harian (satu baris = laporan satu orang pada satu hari) atau notulensi meeting (satu baris = satu meeting, lengkap dengan peserta dan
        tindak lanjut), per minggu atau per bulan, untuk dianalisis di luar aplikasi.
      </p>

      <nav aria-label="Jenis data" className="flex gap-2">
        <Link href={`/owner/tarikan?${periodQ}${companyQ}`} aria-current={jenis === "laporan" ? "page" : undefined} className={tab(jenis === "laporan")}>
          Laporan harian
        </Link>
        <Link href={`/owner/tarikan?jenis=notulensi&${periodQ}${companyQ}`} aria-current={jenis === "notulensi" ? "page" : undefined} className={tab(jenis === "notulensi")}>
          Notulensi
        </Link>
      </nav>

      <nav aria-label="Periode" className="flex gap-2">
        <Link href={`/owner/tarikan?minggu=${week}${companyQ}${jenisQ}`} aria-current={mode === "minggu" ? "page" : undefined} className={tab(mode === "minggu")}>
          Per minggu
        </Link>
        <Link href={`/owner/tarikan?mode=bulan&bulan=${month}${companyQ}${jenisQ}`} aria-current={mode === "bulan" ? "page" : undefined} className={tab(mode === "bulan")}>
          Per bulan
        </Link>
      </nav>

      <form className={`${cardCls} flex flex-wrap items-end gap-3`}>
        {jenis === "notulensi" && <input type="hidden" name="jenis" value="notulensi" />}
        {mode === "bulan" ? (
          <label className={labelCls}>
            Bulan
            <input type="hidden" name="mode" value="bulan" />
            <select name="bulan" defaultValue={month} className={inputCls}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className={labelCls}>
            Tanggal dalam minggu itu
            <input type="date" name="minggu" defaultValue={picked} className={inputCls} />
          </label>
        )}
        <label className={labelCls}>
          Company
          <select name="company" defaultValue={company} className={inputCls}>
            <option value="">Semua company</option>
            {comp.data!.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-white">
          Tampilkan
        </button>
        <span className="flex gap-2 text-sm font-bold">
          <Link href={`/owner/tarikan?${mode === "bulan" ? qs({ bulan: shiftMonth(month, -1) }) : qs({ minggu: addDays(week, -7) })}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            {mode === "bulan" ? "← Bulan lalu" : "← Minggu lalu"}
          </Link>
          <Link href={`/owner/tarikan?${mode === "bulan" ? qs({ bulan: shiftMonth(month, 1) }) : qs({ minggu: addDays(week, 7) })}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            {mode === "bulan" ? "Bulan depan →" : "Minggu depan →"}
          </Link>
        </span>
      </form>

      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">
            {mode === "bulan" ? monthLabel(month) : `Minggu ${formatTanggalPendek(week)} – ${formatTanggalPendek(addDays(week, 6))}`} · {rows.length} {unit}
          </p>
          <div className="flex gap-2">
            <a href={`/owner/tarikan/unduh?${qs({ format: "csv" })}`} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white">
              ⬇ Unduh CSV
            </a>
            <a href={`/owner/tarikan/unduh?${qs({ format: "json" })}`} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-bold">
              ⬇ Unduh JSON
            </a>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Tidak ada {unit} pada {mode === "bulan" ? "bulan" : "minggu"} ini.</p>
        ) : jenis === "notulensi" ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-accent text-left text-white">
                  {["Tanggal", "Judul", "Company", "Penulis", "Status", "Peserta", "Tindak lanjut", "Keputusan"].map((h) => (
                    <th key={h} className="border border-black px-2 py-1.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(rows as MeetingExportRow[]).map((m, i) => (
                  <tr key={`${m.meeting_date}-${m.title}-${i}`}>
                    <td className="border border-black px-2 py-1.5 whitespace-nowrap">{formatTanggalPendek(m.meeting_date)}</td>
                    <td className="border border-black px-2 py-1.5 font-bold">{m.title}</td>
                    <td className="border border-black px-2 py-1.5">{m.company_name}</td>
                    <td className="border border-black px-2 py-1.5">{m.created_by_name ?? "—"}</td>
                    <td className="border border-black px-2 py-1.5">{m.status}</td>
                    <td className="border border-black px-2 py-1.5">{m.attendees.length} orang</td>
                    <td className="border border-black px-2 py-1.5 whitespace-nowrap">
                      {m.action_items.length === 0 ? "—" : `${m.action_items.filter((a) => a.status !== "Selesai").length} belum selesai dari ${m.action_items.length}`}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-xs">{(m.decisions ?? "").slice(0, 140) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-accent text-left text-white">
                  {["Tanggal", "Nama", "Jabatan", "Company", "Aktivitas", "Insight / Kendala"].map((h) => (
                    <th key={h} className="border border-black px-2 py-1.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(rows as WeeklyRow[]).map((r) => (
                  <tr key={`${r.full_name}-${r.report_date}-${r.updated_at}`}>
                    <td className="border border-black px-2 py-1.5 whitespace-nowrap">{formatTanggalPendek(r.report_date)}</td>
                    <td className="border border-black px-2 py-1.5 font-bold">{r.full_name}</td>
                    <td className="border border-black px-2 py-1.5">{r.position_name ?? "—"}</td>
                    <td className="border border-black px-2 py-1.5">{r.company_name}</td>
                    <td className="border border-black px-2 py-1.5">{Array.isArray(r.activities) ? r.activities.length : 0} baris</td>
                    <td className="border border-black px-2 py-1.5 text-xs">
                      {[r.insights, r.obstacles].filter(Boolean).join(" · ").slice(0, 140) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
