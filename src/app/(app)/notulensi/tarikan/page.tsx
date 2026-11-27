import Link from "next/link";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { addDays, formatTanggalPendek, mondayOf, todayJakarta } from "@/lib/date";
import { requireOwnerPage } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { MeetingTabs } from "@/components/meetings/MeetingTabs";
import { loadMeetings } from "@/lib/meeting-export";
import { isMonth, monthLabel, monthRange, shiftMonth } from "@/lib/weekly";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function TarikanNotulensiPage({ searchParams }: PageProps<"/notulensi/tarikan">) {
  await requireOwnerPage();
  const sp = await searchParams;
  const today = todayJakarta();
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
    loadMeetings(start, end, company || null),
    supabase.from("companies").select("id, name").order("name"),
  ]);
  if (comp.error) throw new Error(comp.error.message);

  const qs = (extra: Record<string, string>) => {
    const base: Record<string, string> = mode === "bulan" ? { mode, bulan: month } : { minggu: week };
    const p = new URLSearchParams({ ...base, company, ...extra });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return p.toString();
  };
  const tab = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-accent text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`;
  const companyQ = company ? `&company=${company}` : "";

  return (
    <div className="space-y-4">
      <MeetingTabs active="tarikan" showFollowup showTarikan />
      <h1 className="text-2xl font-bold">Tarikan Notulensi</h1>
      <p className="text-sm text-zinc-600">
        Semua notulensi meeting (satu baris = satu meeting, lengkap dengan peserta dan tindak lanjut) per minggu atau per bulan menurut tanggal
        meeting, untuk dianalisis di luar aplikasi. Draft ikut ditarik dan ditandai statusnya.
      </p>

      <nav aria-label="Periode" className="flex gap-2">
        <Link href={`/notulensi/tarikan?minggu=${week}${companyQ}`} aria-current={mode === "minggu" ? "page" : undefined} className={tab(mode === "minggu")}>
          Per minggu
        </Link>
        <Link href={`/notulensi/tarikan?mode=bulan&bulan=${month}${companyQ}`} aria-current={mode === "bulan" ? "page" : undefined} className={tab(mode === "bulan")}>
          Per bulan
        </Link>
      </nav>

      <form className={`${cardCls} flex flex-wrap items-end gap-3`}>
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
          <Link href={`/notulensi/tarikan?${mode === "bulan" ? qs({ bulan: shiftMonth(month, -1) }) : qs({ minggu: addDays(week, -7) })}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            {mode === "bulan" ? "← Bulan lalu" : "← Minggu lalu"}
          </Link>
          <Link href={`/notulensi/tarikan?${mode === "bulan" ? qs({ bulan: shiftMonth(month, 1) }) : qs({ minggu: addDays(week, 7) })}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            {mode === "bulan" ? "Bulan depan →" : "Minggu depan →"}
          </Link>
        </span>
      </form>

      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">
            {mode === "bulan" ? monthLabel(month) : `Minggu ${formatTanggalPendek(week)} – ${formatTanggalPendek(addDays(week, 6))}`} · {rows.length} notulensi
          </p>
          <div className="flex gap-2">
            <a href={`/notulensi/tarikan/unduh?${qs({ format: "csv" })}`} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white">
              ⬇ Unduh CSV
            </a>
            <a href={`/notulensi/tarikan/unduh?${qs({ format: "json" })}`} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-bold">
              ⬇ Unduh JSON
            </a>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Tidak ada notulensi pada {mode === "bulan" ? "bulan" : "minggu"} ini.</p>
        ) : (
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
                {rows.map((m, i) => (
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
        )}
      </div>
    </div>
  );
}
