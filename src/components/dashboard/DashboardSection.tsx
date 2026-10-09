import Link from "next/link";
import { todayJakarta } from "@/lib/date";
import { monthLabel, monthStart, targetProgress } from "@/lib/target";
import {
  aggregateAdv,
  complianceByDay,
  complianceByPosition,
  complianceTotal,
  eachDay,
  gmvOfReport,
  isWorkday,
  PERIODE_LABEL,
  periodRange,
  presenceRate,
  type AdvRow,
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
  const tim = profile.role !== "employee";
  const today = todayJakarta();
  const range = periodRange(periode, today);
  const days = eachDay(range.from, range.to);
  const companyFilter = profile.role === "owner" && company ? company : null;

  const { data: positions, error: posErr } = await sb.from("roles_config").select("id, code, name");
  if (posErr) throw new Error(posErr.message);
  const names = Object.fromEntries((positions ?? []).map((p) => [p.id as number, p.name as string]));
  const advId = (positions ?? []).find((p) => p.code === "ADV")?.id as number | undefined;

  // Pengguna yang dihitung wajib lapor. Karyawan: hanya dirinya sendiri.
  const users = await fetchAll<UserLite>((a, b) => {
    let q = sb.from("users").select("id, role, is_active, created_at, position_id, full_name").order("id").range(a, b);
    q = tim ? (companyFilter ? q.eq("company_id", companyFilter) : q) : q.eq("id", profile.id);
    return q as unknown as PromiseLike<{ data: UserLite[] | null; error: { message: string } | null }>;
  });

  const reports = (
    await fetchAll<{ user_id: string; report_date: string; position_id: number | null; presensi: string | null }>((a, b) => {
      let q = sb
        .from("daily_reports")
        .select("user_id, report_date, position_id, presensi:performance_metrics->presensi_mandiri->>value")
        .gte("report_date", range.from)
        .lte("report_date", range.to)
        .order("report_date")
        .order("user_id")
        .range(a, b);
      if (companyFilter) q = q.eq("company_id", companyFilter);
      return q as unknown as PromiseLike<{ data: { user_id: string; report_date: string; position_id: number | null; presensi: string | null }[] | null; error: { message: string } | null }>;
    })
  ).map((r): ReportLite => ({ ...r }));

  const advRows = advId
    ? await fetchAll<AdvRow>((a, b) => {
        let q = sb
          .from("daily_reports")
          .select(
            "user_id, report_date, toko:performance_metrics->>toko, data_toko:performance_metrics->data_toko, tarik:performance_metrics->tarik_data_penjualan->>value, tracker:performance_metrics->input_tracker_ads->>value, brief:performance_metrics->brief_qc_upload->>value, presensi:performance_metrics->presensi_mandiri->>value",
          )
          .eq("position_id", advId)
          .gte("report_date", range.from)
          .lte("report_date", range.to)
          .order("report_date")
          .order("user_id")
          .range(a, b);
        if (companyFilter) q = q.eq("company_id", companyFilter);
        return q as unknown as PromiseLike<{ data: AdvRow[] | null; error: { message: string } | null }>;
      })
    : [];

  let kq = sb
    .from("daily_reports")
    .select("id", { count: "exact", head: true })
    .gte("report_date", range.from)
    .lte("report_date", range.to)
    .not("obstacles", "is", null)
    .neq("obstacles", "");
  if (companyFilter) kq = kq.eq("company_id", companyFilter);
  const oq = sb
    .from("meeting_action_items")
    .select("id", { count: "exact", head: true })
    .neq("status", "done")
    .lt("due_date", today);
  const [kRes, oRes] = await Promise.all([kq, oq]);
  if (kRes.error) throw new Error(kRes.error.message);
  if (oRes.error) throw new Error(oRes.error.message);

  // ---- Target omzet bulan ini vs realisasi (GMV form ADV) ----
  let target: DashboardData["target"] = null;
  const monthFrom = monthStart(today);
  let tq = sb.from("omzet_targets").select("user_id, amount").eq("month", monthFrom);
  if (companyFilter) tq = tq.eq("company_id", companyFilter);
  const tRes = await tq;
  const tableMissing = tRes.error?.code === "42P01" || tRes.error?.code === "PGRST205";
  if (tRes.error && !tableMissing) throw new Error(tRes.error.message);
  const targets = tableMissing ? [] : (tRes.data ?? []).filter((t) => Number(t.amount) > 0);
  if (targets.length && advId) {
    const targeted = new Set(targets.map((t) => t.user_id as string));
    const monthRows = await fetchAll<{ user_id: string; report_date: string; data_toko: unknown }>((a, b) => {
      let q = sb
        .from("daily_reports")
        .select("user_id, report_date, data_toko:performance_metrics->data_toko")
        .eq("position_id", advId)
        .gte("report_date", monthFrom)
        .lte("report_date", today)
        .order("report_date")
        .order("user_id")
        .range(a, b);
      if (companyFilter) q = q.eq("company_id", companyFilter);
      return q as unknown as PromiseLike<{ data: { user_id: string; report_date: string; data_toko: unknown }[] | null; error: { message: string } | null }>;
    });
    const dailyActual: Record<string, number> = {};
    const perUser = new Map<string, number>();
    for (const r of monthRows) {
      if (!targeted.has(r.user_id)) continue;
      const g = gmvOfReport(r.data_toko);
      dailyActual[r.report_date] = (dailyActual[r.report_date] ?? 0) + g;
      perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + g);
    }
    const nameOf = new Map(users.map((u) => [u.id, u.full_name ?? "ADV"]));
    const monthlyTotal = targets.reduce((sum, t) => sum + Number(t.amount), 0);
    target = {
      monthLabel: monthLabel(monthFrom),
      progress: targetProgress(monthlyTotal, dailyActual, today),
      advCount: targets.length,
      perAdv: tim
        ? targets
            .map((t) => {
              const actual = perUser.get(t.user_id as string) ?? 0;
              const amount = Number(t.amount);
              return { name: nameOf.get(t.user_id as string) ?? "ADV", actual, target: amount, pct: (100 * actual) / amount };
            })
            .sort((a, b) => b.pct - a.pct)
        : [],
    };
  }

  const dayRows = complianceByDay(users, reports, days);
  const total = complianceTotal(dayRows);
  const todayRow = dayRows.find((x) => x.day === today);
  const mine = new Set(reports.filter((r) => r.user_id === profile.id).map((r) => r.report_date));

  return {
    scope: tim ? "tim" : "saya",
    periode,
    range,
    companyName: profile.role === "owner" ? (companyFilter ? "Company terpilih" : "Semua company") : (profile.company?.name ?? ""),
    compliance: { days: dayRows, total },
    today: todayRow ? { filled: todayRow.filled, expected: todayRow.expected } : null,
    byPosition: tim ? complianceByPosition(users, reports, days, names) : [],
    presence: presenceRate(reports),
    adv: advId ? aggregateAdv(advRows, days) : null,
    target,
    kendala: kRes.count ?? 0,
    overdue: oRes.count ?? 0,
    myDays: tim
      ? undefined
      : days.map((day) => ({
          day,
          label: String(Number(day.slice(8))),
          state: !isWorkday(day) ? ("off" as const) : mine.has(day) ? ("ok" as const) : ("miss" as const),
        })),
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
  return <DashboardView d={data} canSetTarget={profile.role === "owner"} filter={<Filter periode={periode} company={company} companies={companies} />} />;
}
