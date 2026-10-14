import Link from "next/link";
import { redirect } from "next/navigation";
import { cardCls } from "@/components/owner/ui";
import { addDays, formatHariTanggal, formatJam, formatTanggalPendek, todayJakarta, dateFromYmd } from "@/lib/date";
import { mapsUrl, PRESENSI_BUCKET, statusLabel } from "@/lib/presensi";
import { fmtRentang, kindLabel } from "@/lib/leave";
import { monthLabel, monthStart, prevMonth } from "@/lib/target";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Row = {
  user_id: string;
  company_id: string;
  status: string;
  note: string | null;
  check_in_at: string;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_photo_path: string | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_photo_path: string | null;
};
type Person = { id: string; full_name: string; company_id: string; created_at: string; position: { name: string } | null };

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`${cardCls} text-center`}>
      <p className={`text-2xl font-bold ${tone ?? "text-accent"}`}>{value}</p>
      <p className="text-xs text-zinc-600">{label}</p>
    </div>
  );
}

function Maps({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  return lat !== null && lng !== null ? (
    <a href={mapsUrl(lat, lng)} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">
      {label}
    </a>
  ) : (
    <span className="text-zinc-400">—</span>
  );
}

function Photo({ url, label }: { url: string | null | undefined; label: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">
      {label}
    </a>
  ) : (
    <span className="text-zinc-400">—</span>
  );
}

// Rekap presensi harian untuk Manager (company-nya) dan Owner (semua company, bisa difilter). Data disaring RLS.
export default async function RekapPresensiPage({ searchParams }: PageProps<"/presensi/rekap">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (profile.role === "employee") redirect("/presensi");
  const isOwner = profile.role === "owner";

  const sp = await searchParams;
  const today = todayJakarta();
  const tanggal = YMD.test(one(sp.tanggal)) && one(sp.tanggal) <= today ? one(sp.tanggal) : today;
  const company = isOwner ? one(sp.company) : "";

  const supabase = await createClient();
  let presQ = supabase
    .from("presensi")
    .select("user_id, company_id, status, note, check_in_at, check_in_lat, check_in_lng, check_in_photo_path, check_out_at, check_out_lat, check_out_lng, check_out_photo_path")
    .eq("attendance_date", tanggal)
    .order("check_in_at")
    .limit(1000);
  // Pegawai yang wajib presensi: karyawan dan manager aktif (Owner tidak), sudah terdaftar pada hari itu.
  let peopleQ = supabase
    .from("users")
    .select("id, full_name, company_id, created_at, position:roles_config(name)")
    .eq("is_active", true)
    .in("role", ["employee", "manager"])
    .order("full_name")
    .limit(1000);
  if (company) {
    presQ = presQ.eq("company_id", company);
    peopleQ = peopleQ.eq("company_id", company);
  }
  let leaveQ = supabase
    .from("leave_requests")
    .select("user_id, kind, start_date, end_date, reason")
    .eq("status", "approved")
    .lte("start_date", tanggal)
    .gte("end_date", tanggal)
    .limit(1000);
  if (company) leaveQ = leaveQ.eq("company_id", company);
  const [presRes, peopleRes, compRes, leaveRes] = await Promise.all([
    presQ,
    peopleQ,
    isOwner ? supabase.from("companies").select("id, name").order("name") : Promise.resolve({ data: null, error: null }),
    leaveQ,
  ]);
  const tableMissing = presRes.error?.code === "42P01" || presRes.error?.code === "PGRST205";
  if (tableMissing) {
    return (
      <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        Fitur presensi belum aktif: jalankan <code>supabase/008_presensi.sql</code>.
      </p>
    );
  }
  for (const r of [presRes, peopleRes, compRes]) if (r.error) throw new Error(`Gagal memuat rekap presensi: ${r.error.message}`);

  const rows = (presRes.data ?? []) as Row[];
  const people = (peopleRes.data ?? []) as unknown as Person[];
  const companies = compRes.data as { id: string; name: string }[] | null;
  const compName = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const byUser = new Map(people.map((p) => [p.id, p]));
  const endOfDay = new Date(`${tanggal}T23:59:59+07:00`).getTime();
  // Cuti/izin yang disetujui pada tanggal ini (bukan Minggu) dan orangnya belum punya presensi: tidak perlu Check-In.
  const isSundayDay = new Date(`${tanggal}T00:00:00Z`).getUTCDay() === 0;
  const leaveAll = leaveRes.error || isSundayDay ? [] : ((leaveRes.data ?? []) as { user_id: string; kind: string; start_date: string; end_date: string; reason: string }[]);
  const leaves = leaveAll.filter((l) => !rows.some((r) => r.user_id === l.user_id));
  const onLeave = new Set(leaves.map((l) => l.user_id));
  const belum = people.filter((p) => !rows.some((r) => r.user_id === p.id) && !onLeave.has(p.id) && new Date(p.created_at).getTime() <= endOfDay);

  // Alamat foto sementara (berlaku 10 menit) untuk semua foto hari itu.
  const paths = rows.flatMap((r) => [r.check_in_photo_path, r.check_out_photo_path]).filter((x): x is string => !!x);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(PRESENSI_BUCKET).createSignedUrls(paths, 600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const belumPulang = rows.filter((r) => !r.check_out_at && r.status !== "izin" && r.status !== "sakit").length;

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ tanggal, company, ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/presensi/rekap?${p}`;
  };
  const prev = addDays(tanggal, -1);
  const next = addDays(tanggal, 1);
  const showCompany = isOwner && !company;
  const months: string[] = [];
  for (let m = monthStart(today), i = 0; i < 12; i++, m = prevMonth(m)) months.push(m);
  const tanggalMonth = monthStart(tanggal);
  if (!months.includes(tanggalMonth)) months.push(tanggalMonth);
  const inputCls = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm";
  const navCls = "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-bold";

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Rekap Presensi</h1>
      <p className="mt-1 text-sm text-zinc-600">{formatHariTanggal(dateFromYmd(tanggal))}{company && compName.get(company) ? ` · ${compName.get(company)}` : isOwner ? " · Semua company" : ""}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={link({ tanggal: prev })} className={navCls}>← {formatTanggalPendek(prev)}</Link>
        {tanggal < today && (
          <Link href={link({ tanggal: next })} className={navCls}>{formatTanggalPendek(next)} →</Link>
        )}
        <form action="/presensi/rekap" className="flex flex-wrap items-center gap-2">
          <input type="date" name="tanggal" defaultValue={tanggal} max={today} className={inputCls} aria-label="Tanggal" />
          {isOwner && (
            <select name="company" defaultValue={company} className={inputCls} aria-label="Company">
              <option value="">Semua company</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white">Terapkan</button>
        </form>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Stat label="WFO" value={count("wfo")} />
        <Stat label="Tugas Luar" value={count("tugas_luar")} />
        <Stat label="Izin" value={count("izin")} tone="text-amber-700" />
        <Stat label="Sakit" value={count("sakit")} tone="text-amber-700" />
        <Stat label="Cuti/Izin disetujui" value={leaves.length} tone="text-amber-700" />
        <Stat label="Belum Check-In" value={belum.length} tone={belum.length ? "text-red-700" : "text-green-700"} />
      </div>
      {belumPulang > 0 && <p className="mt-2 text-sm text-zinc-600">{belumPulang} orang sudah Check-In tetapi belum Check-Out.</p>}

      <h2 className="mt-6 text-lg font-bold">Sudah Check-In ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada presensi pada tanggal ini.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
              <tr>
                <th className="p-2">Nama</th>
                {showCompany && <th className="p-2">Company</th>}
                <th className="p-2">Jabatan</th>
                <th className="p-2">Status</th>
                <th className="p-2">Masuk</th>
                <th className="p-2">Pulang</th>
                <th className="p-2">Lokasi masuk</th>
                <th className="p-2">Lokasi pulang</th>
                <th className="p-2">Foto</th>
                <th className="p-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = byUser.get(r.user_id);
                const auto = r.status === "izin" || r.status === "sakit";
                return (
                  <tr key={r.user_id} className="border-t border-zinc-100 align-top">
                    <td className="p-2 font-bold">{p?.full_name ?? "—"}</td>
                    {showCompany && <td className="p-2">{compName.get(r.company_id) ?? "—"}</td>}
                    <td className="p-2">{p?.position?.name ?? "—"}</td>
                    <td className="p-2">{statusLabel(r.status)}</td>
                    <td className="p-2">{formatJam(r.check_in_at)}</td>
                    <td className="p-2">
                      {r.check_out_at ? (auto ? `${formatJam(r.check_out_at)} (otomatis)` : formatJam(r.check_out_at)) : auto ? <span className="text-zinc-400">—</span> : <span className="text-red-700">Belum</span>}
                    </td>
                    <td className="p-2"><Maps lat={r.check_in_lat} lng={r.check_in_lng} label="Peta" /></td>
                    <td className="p-2">{auto ? <span className="text-zinc-400">—</span> : <Maps lat={r.check_out_lat} lng={r.check_out_lng} label="Peta" />}</td>
                    <td className="p-2">
                      <div className="flex flex-col gap-0.5">
                        <Photo url={r.check_in_photo_path ? urls.get(r.check_in_photo_path) : null} label="Foto masuk" />
                        <Photo url={r.check_out_photo_path ? urls.get(r.check_out_photo_path) : null} label="Foto pulang" />
                      </div>
                    </td>
                    <td className="max-w-[220px] p-2">{r.note ?? <span className="text-zinc-400">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {leaves.length > 0 && (
        <>
          <h2 className="mt-6 text-lg font-bold">Cuti / Izin disetujui ({leaves.length})</h2>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm shadow-sm">
            {leaves.map((l) => {
              const p = byUser.get(l.user_id);
              return (
                <li key={l.user_id} className="flex flex-wrap justify-between gap-2 p-2">
                  <span><b>{p?.full_name ?? "—"}</b> <span className="text-zinc-600">· {p?.position?.name ?? "—"}{showCompany && p ? ` · ${compName.get(p.company_id) ?? ""}` : ""}</span></span>
                  <span className="text-zinc-700">{kindLabel(l.kind)} · {fmtRentang(l.start_date, l.end_date)} · {l.reason}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="mt-6 text-lg font-bold">Belum Check-In ({belum.length})</h2>
      {belum.length === 0 ? (
        <p className="mt-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">Semua sudah Check-In.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm shadow-sm">
          {belum.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 p-2">
              <span className="font-bold">{p.full_name}</span>
              <span className="text-zinc-600">
                {p.position?.name ?? "—"}
                {showCompany ? ` · ${compName.get(p.company_id) ?? ""}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form action="/presensi/rekap/unduh" className={`${cardCls} mt-6 flex flex-wrap items-center gap-2 text-sm`}>
        <span className="font-bold">Unduh rekap bulanan (CSV, bisa dibuka di Excel):</span>
        <select name="bulan" defaultValue={tanggalMonth} className={inputCls} aria-label="Bulan">
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
        {company && <input type="hidden" name="company" value={company} />}
        <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white">Unduh CSV</button>
      </form>
      <p className="mt-3 text-xs text-zinc-500">Link foto berlaku 10 menit; muat ulang halaman bila sudah kedaluwarsa.</p>
    </div>
  );
}
