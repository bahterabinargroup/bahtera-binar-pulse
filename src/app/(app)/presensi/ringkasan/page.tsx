import Link from "next/link";
import { redirect } from "next/navigation";
import { cardCls } from "@/components/owner/ui";
import { todayJakarta } from "@/lib/date";
import { fmtDurasi, fmtMenitJam, loadRingkasan } from "@/lib/presensi-ringkasan";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { monthLabel, monthStart, parseMonth, prevMonth } from "@/lib/target";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

// Ringkasan presensi per karyawan sebulan: jam masuk/pulang rata-rata, lama di kantor, dan hitungan status.
// Owner semua company (bisa difilter), Manager company-nya, Lead hanya divisinya. Hanya melihat; data disaring RLS.
export default async function RingkasanPresensiPage({ searchParams }: PageProps<"/presensi/ringkasan">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (profile.role === "employee") redirect("/presensi");
  const isOwner = profile.role === "owner";

  const sp = await searchParams;
  const today = todayJakarta();
  const month = parseMonth(one(sp.bulan), monthStart(today));
  const company = isOwner ? one(sp.company) : "";

  const supabase = await createClient();
  const [loaded, compRes] = await Promise.all([
    loadRingkasan(supabase, profile, month, company),
    isOwner ? supabase.from("companies").select("id, name").order("name") : Promise.resolve({ data: null }),
  ]);
  if (loaded.tableMissing) {
    return (
      <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        Fitur presensi belum aktif: jalankan <code>supabase/008_presensi.sql</code>.
      </p>
    );
  }
  const companies = compRes.data as { id: string; name: string }[] | null;
  const compName = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const showCompany = isOwner && !company;
  const { list } = loaded;

  const months: string[] = [];
  for (let m = monthStart(today), i = 0; i < 12; i++, m = prevMonth(m)) months.push(m);
  if (!months.includes(month)) months.push(month);
  const inputCls = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm";
  const num = (n: number) => (n ? String(n) : <span className="text-zinc-400">0</span>);
  const csv = new URLSearchParams({ bulan: month, ...(company ? { company } : {}) });

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Ringkasan Presensi</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {monthLabel(month)}
        {company && compName.get(company) ? ` · ${compName.get(company)}` : isOwner ? " · Semua company" : ""} · dihitung sampai {loaded.to}
        {profile.role === "lead" ? " · karyawan di divisi Anda (hanya melihat)" : ""}
      </p>

      <form action="/presensi/ringkasan" className="mt-3 flex flex-wrap items-center gap-2">
        <select name="bulan" defaultValue={month} className={inputCls} aria-label="Bulan">
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
        {isOwner && (
          <select name="company" defaultValue={company} className={inputCls} aria-label="Company">
            <option value="">Semua company</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white">Terapkan</button>
        <a href={`/presensi/ringkasan/unduh?${csv}`} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white">Unduh CSV</a>
        <Link href="/presensi/rekap" className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-bold">Rekap harian</Link>
      </form>

      {list.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada karyawan untuk ditampilkan.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
              <tr>
                <th className="p-2">Nama</th>
                {showCompany && <th className="p-2">Company</th>}
                <th className="p-2">Jabatan</th>
                <th className="p-2 text-center">WFO</th>
                <th className="p-2 text-center">Tugas Luar</th>
                <th className="p-2 text-center">Izin</th>
                <th className="p-2 text-center">Sakit</th>
                <th className="p-2 text-center">Cuti</th>
                <th className="p-2 text-center">Rata-rata masuk</th>
                <th className="p-2 text-center">Rata-rata pulang</th>
                <th className="p-2 text-center">Total di kantor</th>
                <th className="p-2 text-center">Rata-rata/hari</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.person.id} className="border-t border-zinc-100 align-top">
                  <td className="p-2 font-bold">{r.person.full_name}</td>
                  {showCompany && <td className="p-2">{compName.get(r.person.company_id) ?? "—"}</td>}
                  <td className="p-2">{r.person.position?.name ?? "—"}</td>
                  <td className="p-2 text-center">{num(r.wfo)}</td>
                  <td className="p-2 text-center">{num(r.tugasLuar)}</td>
                  <td className="p-2 text-center">{num(r.izin)}</td>
                  <td className="p-2 text-center">{num(r.sakit)}</td>
                  <td className="p-2 text-center">{num(r.cuti)}</td>
                  <td className="p-2 text-center">{fmtMenitJam(r.avgMasukMenit)}</td>
                  <td className="p-2 text-center">
                    {fmtMenitJam(r.avgPulangMenit)}
                    {r.belumPulang > 0 && <span className="block text-xs text-red-700">{r.belumPulang}x lupa Check-Out</span>}
                  </td>
                  <td className="p-2 text-center">{fmtDurasi(r.kantorMenit)}</td>
                  <td className="p-2 text-center">{r.kantorHari ? fmtDurasi(Math.round(r.kantorMenit / r.kantorHari)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-500">
        <li>Angka status dihitung dalam hari. Izin dan Cuti termasuk yang disetujui lewat menu Cuti / Izin (hari yang sudah punya presensi tidak dihitung dua kali; Minggu tidak dihitung).</li>
        <li>&quot;Total di kantor&quot; = selisih Check-In dan Check-Out pada hari WFO. Tugas Luar tidak dihitung sebagai waktu di kantor; hari tanpa Check-Out juga tidak dihitung.</li>
        <li>Jam rata-rata mencakup hari WFO dan Tugas Luar (WIB).</li>
      </ul>
      <p className={`${cardCls} mt-3 text-xs text-zinc-600`}>Butuh rincian per hari? Buka Rekap harian lalu unduh CSV bulanan (sekarang memuat kolom lama di kantor).</p>
    </div>
  );
}
