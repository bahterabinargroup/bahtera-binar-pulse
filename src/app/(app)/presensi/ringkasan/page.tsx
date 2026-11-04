import Link from "next/link";
import { redirect } from "next/navigation";
import { formatTanggalPendek, todayJakarta } from "@/lib/date";
import { fmtDurasi, fmtJamWib, fmtMenitJam, loadRingkasan, statusHari, type Ringkasan } from "@/lib/presensi-ringkasan";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { monthLabel, monthStart, parseMonth, prevMonth } from "@/lib/target";

type Item = { r: Ringkasan; dates: string[] };
function Insight({ title, hint, tone, items, detailHref, showCompany, compName }: { title: string; hint: string; tone: "red" | "amber"; items: Item[]; detailHref: (id: string) => string; showCompany: boolean; compName: Map<string, string> }) {
  const cls = tone === "red" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50";
  const total = items.reduce((a, i) => a + i.dates.length, 0);
  return (
    <section className={`rounded-xl border p-3 ${cls}`}>
      <h2 className="font-bold">{title} <span className="font-normal text-zinc-600">· {items.length} orang, {total} hari</span></h2>
      <p className="text-xs text-zinc-600">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-green-800">Tidak ada.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {items.map(({ r, dates }) => (
            <li key={r.person.id}>
              <Link href={detailHref(r.person.id)} className="font-bold text-accent underline">{r.person.full_name}</Link>
              <span className="text-zinc-600"> · {r.person.position?.name ?? "—"}{showCompany ? ` · ${compName.get(r.person.company_id) ?? ""}` : ""} · </span>
              <b>{dates.length} hari</b>
              <span className="block text-xs text-zinc-600">{dates.map((d) => formatTanggalPendek(d)).join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
  const pilih = list.find((r) => r.person.id === one(sp.karyawan)) ?? null;
  const detailHref = (id: string) => `/presensi/ringkasan?${new URLSearchParams({ bulan: month, ...(company ? { company } : {}), karyawan: id })}#rincian`;
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
        <a href={`/presensi/ringkasan/unduh?${csv}`} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white">Unduh ringkasan (CSV)</a>
        <a href={`/presensi/ringkasan/unduh?${csv}&rinci=1`} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white">Unduh per tanggal (CSV)</a>
        <Link href="/presensi/rekap" className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-bold">Rekap harian</Link>
      </form>

      {list.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Insight title="Tanpa keterangan" hint="Tidak ada presensi, tidak izin, dan tidak cuti disetujui" tone="red" items={list.filter((r) => r.tanpaKet.length).map((r) => ({ r, dates: r.tanpaKet })).sort((a, b) => b.dates.length - a.dates.length)} detailHref={detailHref} showCompany={showCompany} compName={compName} />
          <Insight title="Tidak Check-Out" hint="Sudah Check-In tetapi tidak Check-Out (WFO atau Tugas Luar)" tone="amber" items={list.filter((r) => r.lupaOut.length).map((r) => ({ r, dates: r.lupaOut })).sort((a, b) => b.dates.length - a.dates.length)} detailHref={detailHref} showCompany={showCompany} compName={compName} />
        </div>
      )}

      {list.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada karyawan untuk ditampilkan.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[1060px] text-left text-sm">
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
                <th className="p-2 text-center">Tanpa keterangan</th>
                <th className="p-2 text-center">Rata-rata masuk</th>
                <th className="p-2 text-center">Rata-rata pulang</th>
                <th className="p-2 text-center">Total di kantor</th>
                <th className="p-2 text-center">Rata-rata/hari</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.person.id} className="border-t border-zinc-100 align-top">
                  <td className="p-2 font-bold">
                    <Link href={detailHref(r.person.id)} className="text-accent underline">{r.person.full_name}</Link>
                  </td>
                  {showCompany && <td className="p-2">{compName.get(r.person.company_id) ?? "—"}</td>}
                  <td className="p-2">{r.person.position?.name ?? "—"}</td>
                  <td className="p-2 text-center">{num(r.wfo)}</td>
                  <td className="p-2 text-center">{num(r.tugasLuar)}</td>
                  <td className="p-2 text-center">{num(r.izin)}</td>
                  <td className="p-2 text-center">{num(r.sakit)}</td>
                  <td className="p-2 text-center">{num(r.cuti)}</td>
                  <td className="p-2 text-center">{r.tanpaKet.length ? <b className="text-red-700">{r.tanpaKet.length}</b> : num(0)}</td>
                  <td className="p-2 text-center">{fmtMenitJam(r.avgMasukMenit)}</td>
                  <td className="p-2 text-center">
                    {fmtMenitJam(r.avgPulangMenit)}
                    {r.belumPulang > 0 && <span className="block text-xs text-red-700">{r.belumPulang}x tidak Check-Out</span>}
                  </td>
                  <td className="p-2 text-center">{fmtDurasi(r.kantorMenit)}</td>
                  <td className="p-2 text-center">{r.kantorHari ? fmtDurasi(Math.round(r.kantorMenit / r.kantorHari)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-zinc-600">Klik nama karyawan untuk melihat jam masuk, jam pulang, dan lama di kantor tiap tanggal.</p>

      {pilih && (
        <section id="rincian" className="mt-6 scroll-mt-20">
          <h2 className="text-lg font-bold">Rincian per tanggal — {pilih.person.full_name}</h2>
          <p className="text-sm text-zinc-600">{pilih.person.position?.name ?? "—"} · {monthLabel(month)}</p>
          {pilih.harian.length === 0 ? (
            <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada presensi pada bulan ini.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
                  <tr>
                    <th className="p-2">Tanggal</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-center">Masuk</th>
                    <th className="p-2 text-center">Pulang</th>
                    <th className="p-2 text-center">Lama di kantor</th>
                  </tr>
                </thead>
                <tbody>
                  {pilih.harian.map((h) => (
                    <tr key={h.date + h.status} className="border-t border-zinc-100">
                      <td className="p-2">{formatTanggalPendek(h.date)}</td>
                      <td className="p-2">{statusHari(h.status)}</td>
                      <td className="p-2 text-center">{fmtJamWib(h.masuk)}</td>
                      <td className="p-2 text-center">
                        {h.pulang ? `${fmtJamWib(h.pulang)}${h.otomatis ? " (otomatis)" : ""}` : h.masuk && !h.otomatis ? <span className="text-red-700">Belum</span> : "—"}
                      </td>
                      <td className="p-2 text-center">{h.menit !== null ? fmtDurasi(h.menit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold">
                  <tr>
                    <td className="p-2" colSpan={2}>Rata-rata</td>
                    <td className="p-2 text-center">{fmtMenitJam(pilih.avgMasukMenit)}</td>
                    <td className="p-2 text-center">{fmtMenitJam(pilih.avgPulangMenit)}</td>
                    <td className="p-2 text-center">{pilih.kantorHari ? fmtDurasi(Math.round(pilih.kantorMenit / pilih.kantorHari)) : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-500">
        <li>Angka status dihitung dalam hari. Izin dan Cuti termasuk yang disetujui lewat menu Cuti / Izin (hari yang sudah punya presensi tidak dihitung dua kali; Minggu tidak dihitung).</li>
        <li>&quot;Total di kantor&quot; = selisih Check-In dan Check-Out pada hari WFO. Tugas Luar tidak dihitung sebagai waktu di kantor; hari tanpa Check-Out juga tidak dihitung.</li>
        {(loaded.libur?.length ?? 0) > 0 && <li>Hari libur bulan ini: {loaded.libur!.map((d) => formatTanggalPendek(d)).join(", ")}.</li>}
        <li>&quot;Tanpa keterangan&quot; = hari kerja (Senin–Sabtu) sejak akun dibuat sampai kemarin tanpa presensi dan tanpa cuti/izin disetujui. Tanggal yang terdaftar di menu Hari Libur tidak dihitung.</li>
        <li>Jam rata-rata mencakup hari WFO dan Tugas Luar (WIB).</li>
      </ul>
    </div>
  );
}
