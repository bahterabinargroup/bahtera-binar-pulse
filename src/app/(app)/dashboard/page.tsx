import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addDays,
  dateFromYmd,
  formatHariTanggal,
  formatJam,
  formatTanggalPendek,
  mondayOf,
  todayJakarta,
} from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Missing = { user_id: string; full_name: string; position_name: string | null; company_name: string };
type Submitted = {
  id: string;
  updated_at: string;
  user: { full_name: string } | null;
  position: { name: string } | null;
  company: { name: string } | null;
};
type Compliance = {
  user_id: string;
  full_name: string;
  position_name: string | null;
  company_name: string;
  expected_days: number;
  filled_days: number;
  missing_dates: string[];
  compliance_pct: number | null;
};

// Dashboard Manager (company-nya) dan Owner (semua company, bisa difilter).
// Data disaring RLS dan fungsi database; karyawan biasa tidak boleh membuka halaman ini.
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (profile.role === "employee") redirect("/");
  const isOwner = profile.role === "owner";

  const sp = await searchParams;
  const today = todayJakarta();
  const tanggal = YMD.test(one(sp.tanggal)) && one(sp.tanggal) <= today ? one(sp.tanggal) : today;
  const company = isOwner ? one(sp.company) : "";
  const companyArg = company || null;
  const weekStart = mondayOf(tanggal);

  const supabase = await createClient();
  let submittedQuery = supabase
    .from("daily_reports")
    .select("id, updated_at, user:users(full_name), position:roles_config(name), company:companies(name)")
    .eq("report_date", tanggal)
    .order("updated_at", { ascending: false });
  if (companyArg) submittedQuery = submittedQuery.eq("company_id", companyArg);

  const [missingRes, submittedRes, complianceRes, companiesRes] = await Promise.all([
    supabase.rpc("get_missing_reports", { p_date: tanggal, p_company_id: companyArg }),
    submittedQuery,
    supabase.rpc("get_weekly_report_compliance", { p_week_start: weekStart, p_company_id: companyArg }),
    isOwner ? supabase.from("companies").select("id, name").order("name") : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [missingRes, submittedRes, complianceRes, companiesRes]) {
    if (r.error) throw new Error(`Gagal memuat dashboard: ${r.error.message}`);
  }
  const missing = (missingRes.data ?? []) as Missing[];
  const submitted = (submittedRes.data ?? []) as unknown as Submitted[];
  const compliance = (complianceRes.data ?? []) as Compliance[];
  const companies = companiesRes.data as { id: string; name: string }[] | null;

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ tanggal, company, ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/dashboard?${p}`;
  };
  const showCompany = isOwner && !company;
  const inputCls = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard Tim</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {isOwner ? "Semua company" : (profile.company?.name ?? "")} · {formatHariTanggal(dateFromYmd(tanggal))}
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-white p-3">
        <label className="text-xs font-bold">
          Tanggal
          <input type="date" name="tanggal" defaultValue={tanggal} max={today} className={`${inputCls} mt-1 block`} />
        </label>
        {companies && (
          <label className="text-xs font-bold">
            Company
            <select name="company" defaultValue={company} className={`${inputCls} mt-1 block`}>
              <option value="">Semua company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-bold text-white">
          Tampilkan
        </button>
        <div className="flex gap-2 text-sm font-bold">
          <Link href={link({ tanggal: addDays(tanggal, -1) })} className="rounded-lg border border-zinc-300 px-3 py-1.5">
            ← Kemarin
          </Link>
          {tanggal !== today && (
            <>
              <Link href={link({ tanggal: addDays(tanggal, 1) })} className="rounded-lg border border-zinc-300 px-3 py-1.5">
                Besok →
              </Link>
              <Link href={link({ tanggal: today })} className="rounded-lg border border-zinc-300 px-3 py-1.5">
                Hari ini
              </Link>
            </>
          )}
        </div>
      </form>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Laporan masuk" value={submitted.length} tone="green" />
        <Stat label="Belum mengisi" value={missing.length} tone={missing.length ? "red" : "green"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={`Belum mengisi (${missing.length})`}>
          {missing.length === 0 ? (
            <p className="text-sm text-green-700">Semua sudah mengisi. 🎉</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {missing.map((m) => (
                <li key={m.user_id} className="py-2">
                  <p className="font-bold">{m.full_name}</p>
                  <p className="text-sm text-zinc-600">
                    {m.position_name ?? "Tanpa jabatan"}
                    {showCompany ? ` · ${m.company_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Laporan masuk (${submitted.length})`}>
          {submitted.length === 0 ? (
            <p className="text-sm text-zinc-500">Belum ada laporan pada tanggal ini.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {submitted.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/laporan/${r.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-accent">
                    <span>
                      <span className="block font-bold">{r.user?.full_name ?? "—"}</span>
                      <span className="block text-sm text-zinc-600">
                        {r.position?.name ?? "Tanpa jabatan"}
                        {showCompany && r.company ? ` · ${r.company.name}` : ""} · {formatJam(r.updated_at)} WIB
                      </span>
                    </span>
                    <span className="text-sm font-bold text-accent">Lihat →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title={`Kepatuhan minggu ${formatTanggalPendek(weekStart)} – ${formatTanggalPendek(addDays(weekStart, 5))}`}
        className="mt-6"
      >
        <p className="mb-2 text-xs text-zinc-500">Hari kerja Senin–Sabtu; hari yang belum tiba dan hari sebelum akun dibuat tidak dihitung.</p>
        {compliance.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum ada data minggu ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-accent text-left text-white">
                  <th className="border border-black px-2 py-1.5">Nama</th>
                  <th className="border border-black px-2 py-1.5">Jabatan</th>
                  {showCompany && <th className="border border-black px-2 py-1.5">Company</th>}
                  <th className="border border-black px-2 py-1.5">Terisi</th>
                  <th className="border border-black px-2 py-1.5">%</th>
                  <th className="border border-black px-2 py-1.5">Tidak mengisi</th>
                </tr>
              </thead>
              <tbody>
                {compliance.map((c) => {
                  const pct = c.compliance_pct ?? 0;
                  const tone = pct >= 100 ? "text-green-700" : pct >= 80 ? "text-amber-700" : "text-red-700";
                  return (
                    <tr key={c.user_id}>
                      <td className="border border-black px-2 py-1.5 font-bold">{c.full_name}</td>
                      <td className="border border-black px-2 py-1.5">{c.position_name ?? "—"}</td>
                      {showCompany && <td className="border border-black px-2 py-1.5">{c.company_name}</td>}
                      <td className="border border-black px-2 py-1.5">
                        {c.filled_days}/{c.expected_days}
                      </td>
                      <td className={`border border-black px-2 py-1.5 font-bold ${tone}`}>{c.expected_days ? `${pct}%` : "—"}</td>
                      <td className="border border-black px-2 py-1.5 text-xs">
                        {c.missing_dates.length ? c.missing_dates.map(formatTanggalPendek).join(", ") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "green" | "red" }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${tone === "red" ? "border-red-300" : "border-zinc-200"}`}>
      <p className="text-sm text-zinc-600">{label}</p>
      <p className={`text-3xl font-bold ${tone === "red" ? "text-red-700" : "text-green-700"}`}>{value}</p>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  );
}
