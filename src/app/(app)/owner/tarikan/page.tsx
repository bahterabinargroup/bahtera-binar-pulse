import Link from "next/link";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { addDays, formatTanggalPendek, mondayOf, todayJakarta } from "@/lib/date";
import { requireOwnerPage } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { loadWeekly } from "@/lib/weekly";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function OwnerTarikanPage({ searchParams }: PageProps<"/owner/tarikan">) {
  await requireOwnerPage();
  const sp = await searchParams;
  const picked = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.minggu)) ? one(sp.minggu) : todayJakarta();
  const week = mondayOf(picked);
  const company = one(sp.company);

  const supabase = await createClient();
  const [rows, comp] = await Promise.all([
    loadWeekly(week, company || null),
    supabase.from("companies").select("id, name").order("name"),
  ]);
  if (comp.error) throw new Error(comp.error.message);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ minggu: week, company, ...extra });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return p.toString();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tarikan Mingguan</h1>
      <p className="text-sm text-zinc-600">
        Semua laporan satu minggu (Senin–Minggu) untuk dianalisis di luar aplikasi.
      </p>

      <form className={`${cardCls} flex flex-wrap items-end gap-3`}>
        <label className={labelCls}>
          Tanggal dalam minggu itu
          <input type="date" name="minggu" defaultValue={picked} className={inputCls} />
        </label>
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
          <Link href={`/owner/tarikan?${qs({ minggu: addDays(week, -7) })}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            ← Minggu lalu
          </Link>
          <Link href={`/owner/tarikan?${qs({ minggu: addDays(week, 7) })}`} className="rounded-lg border border-zinc-300 px-3 py-2">
            Minggu depan →
          </Link>
        </span>
      </form>

      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">
            Minggu {formatTanggalPendek(week)} – {formatTanggalPendek(addDays(week, 6))} · {rows.length} laporan
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
          <p className="mt-3 text-sm text-zinc-500">Tidak ada laporan pada minggu ini.</p>
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
                {rows.map((r) => (
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
