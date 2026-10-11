import Link from "next/link";
import { todayJakarta } from "@/lib/date";
import {
  complianceByDay,
  complianceByPosition,
  complianceTotal,
  eachDay,
  PERIODE_LABEL,
  periodRange,
  type Periode,
  type ReportLite,
  type UserLite,
} from "@/lib/dashboard";
import type { Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { DashboardView, type DashboardData } from "./DashboardView";

type Sb = Awaited<ReturnType<typeof createClient>>;
const PAGE = 1000;

// PostgREST membatasi 1000 baris per permintaan: ambil bertahap sampai habis.
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function buildData(sb: Sb, profile: Profile, periode: Periode, company: string): Promise<DashboardData> {
  const today = todayJakarta();
  const range = periodRange(periode, today);
  const days = eachDay(range.from, range.to);
  const companyFilter = profile.role === "owner" && company ? company : null;

  // Hanya data yang diisi SEMUA divisi: laporan harian (kepatuhan, kendala), presensi, dan tugas notulensi.
  // Semua pertanyaan dijalankan bersamaan supaya Beranda cepat.
  const kq0 = sb
    .from("daily_reports")
    .select("id", { count: "exact", head: true })
    .gte("report_date", range.from)
    .lte("report_date", range.to)
    .not("obstacles", "is", null)
    .neq("obstacles", "");
  const kq = companyFilter ? kq0.eq("company_id", companyFilter) : kq0;
  const oq = sb.from("meeting_action_items").select("id", { count: "exact", head: true }).neq("status", "done").lt("due_date", today);

  const [posRes, users, reportsRaw, presRaw, kRes, oRes] = await Promise.all([
    sb.from("roles_config").select("id, code, name"),
    fetchAll<UserLite>((a, b) => {
      let q = sb.from("users").select("id, role, is_active, created_at, position_id, full_name").order("id").range(a, b);
      if (companyFilter) q = q.eq("company_id", companyFilter);
      return q as unknown as PromiseLike<{ data: UserLite[] | null; error: { message: string } | null }>;
    }),
    fetchAll<{ user_id: string; report_date: string; position_id: number | null }>((a, b) => {
      let q = sb
        .from("daily_reports")
        .select("user_id, report_date, position_id")
        .gte("report_date", range.from)
        .lte("report_date", range.to)
        .order("report_date")
        .order("user_id")
        .range(a, b);
      if (companyFilter) q = q.eq("company_id", companyFilter);
      return q as unknown as PromiseLike<{ data: { user_id: string; report_date: string; position_id: number | null }[] | null; error: { message: string } | null }>;
    }),
    fetchAll<{ user_id: string; attendance_date: string; position_id: number | null; status: string; check_out_at: string | null }>((a, b) => {
      let q = sb
        .from("presensi")
        .select("user_id, attendance_date, position_id, status, check_out_at")
        .gte("attendance_date", range.from)
        .lte("attendance_date", range.to)
        .order("attendance_date")
        .order("user_id")
        .range(a, b);
      if (companyFilter) q = q.eq("company_id", companyFilter);
      return q as unknown as PromiseLike<{ data: { user_id: string; attendance_date: string; position_id: number | null; status: string; check_out_at: string | null }[] | null; error: { message: string } | null }>;
    }).catch((e: Error) => (/presensi|42P01|PGRST205/i.test(e.message) ? [] : Promise.reject(e))),
    kq,
    oq,
  ]);
  if (posRes.error) throw new Error(posRes.error.message);
  if (kRes.error) throw new Error(kRes.error.message);
  if (oRes.error) throw new Error(oRes.error.message);
  const names = Object.fromEntries((posRes.data ?? []).map((p) => [p.id as number, p.name as string]));

  const reports = reportsRaw.map((r): ReportLite => ({ ...r, presensi: null }));
  // Presensi dipetakan ke bentuk yang sama agar memakai hitungan kepatuhan yang sama.
  const checkins = presRaw.map((r): ReportLite => ({ user_id: r.user_id, report_date: r.attendance_date, position_id: r.position_id, presensi: null }));

  const dayRows = complianceByDay(users, reports, days);
  const presDays = complianceByDay(users, checkins, days);
  const todayRow = dayRows.find((x) => x.day === today);
  const presToday = presDays.find((x) => x.day === today);
  const statusCount = (st: string) => presRaw.filter((r) => r.status === st).length;
  const todayRows = presRaw.filter((r) => r.attendance_date === today);

  return {
    periode,
    range,
    companyName: profile.role === "owner" ? (companyFilter ? "Company terpilih" : "Semua company") : (profile.company?.name ?? ""),
    compliance: { days: dayRows, total: complianceTotal(dayRows) },
    today: todayRow ? { filled: todayRow.filled, expected: todayRow.expected } : null,
    byPosition: complianceByPosition(users, reports, days, names),
    presensi: {
      days: presDays,
      total: complianceTotal(presDays),
      today: presToday ? { filled: presToday.filled, expected: presToday.expected, belumPulang: todayRows.filter((r) => !r.check_out_at && r.status !== "izin" && r.status !== "sakit").length } : null,
      byPosition: complianceByPosition(users, checkins, days, names),
      status: { wfo: statusCount("wfo"), tugas_luar: statusCount("tugas_luar"), izin: statusCount("izin"), sakit: statusCount("sakit") },
    },
    kendala: kRes.count ?? 0,
    overdue: oRes.count ?? 0,
  };
}

// Filter periode (semua peran) dan company (khusus Owner). Memakai tautan biasa, tanpa JavaScript.
function Filter({ periode, company, companies }: { periode: Periode; company: string; companies: { id: string; name: string }[] | null }) {
  const href = (p: Periode, c: string) => `/?${new URLSearchParams({ periode: p, ...(c ? { company: c } : {}) })}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Periode" className="flex flex-wrap gap-1">
        {(Object.keys(PERIODE_LABEL) as Periode[]).map((p) => (
          <Link
            key={p}
            href={href(p, company)}
            className={`rounded-full px-3 py-1 text-sm font-bold ${p === periode ? "bg-accent text-white" : "border border-zinc-300 bg-white text-zinc-700"}`}
          >
            {PERIODE_LABEL[p]}
          </Link>
        ))}
      </nav>
      {companies && (
        <form action="/" className="flex items-center gap-1">
          <input type="hidden" name="periode" value={periode} />
          <select name="company" defaultValue={company} aria-label="Company" className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm">
            <option value="">Semua company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-1 text-sm font-bold text-white">
            Terapkan
          </button>
        </form>
      )}
    </div>
  );
}

export async function DashboardSection({ profile, periode, company }: { profile: Profile; periode: Periode; company: string }) {
  const sb = await createClient();
  let companies: { id: string; name: string }[] | null = null;
  if (profile.role === "owner") {
    const { data } = await sb.from("companies").select("id, name").eq("is_active", true).order("name");
    companies = data ?? [];
  }
  let data: DashboardData | null = null;
  let failure = "";
  try {
    data = await buildData(sb, profile, periode, company);
    if (company && companies) data.companyName = companies.find((c) => c.id === company)?.name ?? data.companyName;
  } catch (e) {
    failure = e instanceof Error ? e.message : "kesalahan tak dikenal";
  }
  if (!data) {
    return (
      <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Dashboard belum bisa dimuat ({failure}). Menu di bawah tetap bisa dipakai.
      </p>
    );
  }
  return <DashboardView d={data} filter={<Filter periode={periode} company={company} companies={companies} />} />;
}
