import Link from "next/link";
import { redirect } from "next/navigation";
import { cardCls } from "@/components/owner/ui";
import { addDays, todayJakarta } from "@/lib/date";
import { fmtRentang, kindLabel, LEAVE_COLUMNS, leaveDaysIn, workdaysBetween, type LeaveRow } from "@/lib/leave";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { monthEnd, monthLabel, monthStart, nextMonth, parseMonth, prevMonth } from "@/lib/target";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

type Person = { id: string; full_name: string; position: { name: string } | null };
type Entry = { name: string; kind: string; pending: boolean };

// Kalender cuti/izin tim per bulan. Data disaring RLS: Owner semua (bisa pilih company), Manager company-nya,
// Lead hanya karyawan divisinya. Karyawan biasa tidak membuka halaman ini.
export default async function KalenderCutiPage({ searchParams }: PageProps<"/cuti/kalender">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (profile.role === "employee") redirect("/cuti");
  const isOwner = profile.role === "owner";

  const sp = await searchParams;
  const today = todayJakarta();
  const month = parseMonth(one(sp.bulan), monthStart(today));
  const from = month;
  const to = monthEnd(month);
  const company = isOwner ? one(sp.company) : "";

  const supabase = await createClient();
  let q = supabase
    .from("leave_requests")
    .select(LEAVE_COLUMNS)
    .in("status", ["approved", "pending"])
    .lte("start_date", to)
    .gte("end_date", from)
    .order("start_date")
    .limit(1000);
  if (company) q = q.eq("company_id", company);
  const [leaveRes, compRes] = await Promise.all([q, isOwner ? supabase.from("companies").select("id, name").order("name") : Promise.resolve({ data: null, error: null })]);
  const tableMissing = leaveRes.error?.code === "42P01" || leaveRes.error?.code === "PGRST205";
  if (tableMissing) return <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Fitur cuti/izin belum aktif. Jalankan supabase/011 dan 012.</p>;
  for (const r of [leaveRes, compRes]) if (r.error) throw new Error(`Gagal memuat kalender: ${r.error.message}`);
  // Pengajuan menunggu yang tanggalnya sudah lewat = kedaluwarsa, tidak ditampilkan.
  const rows = ((leaveRes.data ?? []) as unknown as LeaveRow[]).filter((r) => r.status === "approved" || r.end_date >= today);
  const companies = compRes.data as { id: string; name: string }[] | null;

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: ppl } = ids.length ? await supabase.from("users").select("id, full_name, position:roles_config(name)").in("id", ids) : { data: [] };
  const people = new Map(((ppl ?? []) as unknown as Person[]).map((p) => [p.id, p]));

  // Peta tanggal -> siapa yang cuti/izin (hari kerja Senin–Sabtu saja)
  const byDay = new Map<string, Entry[]>();
  for (const r of rows) {
    for (const day of leaveDaysIn(r, from, to)) {
      const list = byDay.get(day) ?? [];
      list.push({ name: people.get(r.user_id)?.full_name ?? "—", kind: r.kind, pending: r.status === "pending" });
      byDay.set(day, list);
    }
  }

  // Kerangka kalender: minggu mulai Senin
  const firstDow = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(from, -firstDow);
  const lastDow = (new Date(`${to}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridEnd = addDays(to, 6 - lastDow);
  const cells: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(d);

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ bulan: month.slice(0, 7), company, ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/cuti/kalender?${p}`;
  };
  const navCls = "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-bold";
  const chip = (e: Entry) =>
    `${e.kind === "cuti" ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900"} ${e.pending ? "border border-dashed border-zinc-500 italic" : ""}`;

  const totalHari = rows.reduce((s, r) => s + leaveDaysIn(r, from, to).length, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Kalender Cuti / Izin</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {isOwner ? "Semua company" : profile.role === "lead" ? "Karyawan di divisi Anda (hanya melihat)." : "Karyawan dan Lead di company Anda."} Hari Minggu tidak dihitung.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={link({ bulan: prevMonth(month).slice(0, 7) })} className={navCls}>← {monthLabel(prevMonth(month))}</Link>
        <span className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white">{monthLabel(month)}</span>
        <Link href={link({ bulan: nextMonth(month).slice(0, 7) })} className={navCls}>{monthLabel(nextMonth(month))} →</Link>
        {month !== monthStart(today) && <Link href={link({ bulan: monthStart(today).slice(0, 7) })} className={navCls}>Bulan ini</Link>}
        {isOwner && companies && (
          <form action="/cuti/kalender" className="flex items-center gap-2">
            <input type="hidden" name="bulan" value={month.slice(0, 7)} />
            <select name="company" defaultValue={company} aria-label="Company" className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm">
              <option value="">Semua company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white">Terapkan</button>
          </form>
        )}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-700">
        <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-900">Cuti (disetujui)</span>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">Izin (disetujui)</span>
        <span className="rounded border border-dashed border-zinc-500 px-2 py-0.5 italic">Cetak miring bergaris putus = masih menunggu keputusan</span>
      </p>

      <div className="mt-3 hidden overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm md:block">
        <div className="grid grid-cols-7 bg-zinc-50 text-center text-xs font-bold uppercase text-zinc-600">
          {HARI.map((h) => (
            <div key={h} className="border-b border-zinc-200 p-2">{h}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const inMonth = day >= from && day <= to;
            const sunday = new Date(`${day}T00:00:00Z`).getUTCDay() === 0;
            const list = inMonth ? (byDay.get(day) ?? []) : [];
            return (
              <div key={day} className={`min-h-24 border-b border-r border-zinc-100 p-1.5 ${!inMonth ? "bg-zinc-50 text-zinc-300" : sunday ? "bg-zinc-100" : ""} ${day === today ? "ring-2 ring-inset ring-gold" : ""}`}>
                <p className={`text-xs font-bold ${day === today ? "text-accent" : ""}`}>{Number(day.slice(8))}</p>
                <ul className="mt-1 space-y-0.5">
                  {list.map((e, i) => (
                    <li key={i} className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${chip(e)}`} title={`${e.name} · ${kindLabel(e.kind)}${e.pending ? " (menunggu)" : ""}`}>
                      {e.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="mt-6 text-lg font-bold">Daftar {monthLabel(month)} ({rows.length} pengajuan, {totalHari} hari kerja)</h2>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Tidak ada cuti atau izin pada bulan ini.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r) => {
            const p = people.get(r.user_id);
            return (
              <li key={r.id} className={`${cardCls} text-sm`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{p?.full_name ?? "—"} <span className="font-normal text-zinc-600">· {p?.position?.name ?? "—"}</span></p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.status === "approved" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
                    {r.status === "approved" ? "Disetujui" : "Menunggu keputusan"}
                  </span>
                </div>
                <p className="mt-1">{kindLabel(r.kind)} · {fmtRentang(r.start_date, r.end_date)} ({workdaysBetween(r.start_date, r.end_date)} hari kerja)</p>
                <p className="mt-1 text-zinc-700">Alasan: {r.reason}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
