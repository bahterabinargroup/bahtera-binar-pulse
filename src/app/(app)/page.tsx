import Link from "next/link";
import { Suspense } from "react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { parsePeriode } from "@/lib/dashboard";
import { formatHariTanggal, formatJam, todayJakarta } from "@/lib/date";
import { kindLabel } from "@/lib/leave";
import { statusLabel } from "@/lib/presensi";
import { LinkGroups } from "@/components/links/LinkGroups";
import { LINK_SELECT, positionNameMap, type ResourceLink } from "@/lib/links";
import { menuFor } from "@/lib/menu";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function BerandaPage({ searchParams }: PageProps<"/">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null; // ditangani layout
  const params = await searchParams;
  const items = menuFor(profile.role);

  // Ringkasan hari ini. Bila satu pertanyaan ke database gagal, kartunya dilewati (Beranda tetap tampil).
  const supabase = await createClient();
  const today = todayJakarta();
  const isLeader = profile.role !== "employee";
  const hasForm = !!profile.position;
  const wajibPresensi = profile.role !== "owner";
  const [reportRes, tasksRes, missingRes, deleteRes, linksRes, posRes, myPresRes, presTodayRes, peopleRes, excusedRes, leaveTodayRes, leaveOpenRes] = await Promise.all([
    hasForm
      ? supabase.from("daily_reports").select("updated_at").eq("user_id", profile.id).eq("report_date", today).maybeSingle()
      : Promise.resolve(null),
    supabase.rpc("get_my_action_items"),
    isLeader ? supabase.rpc("get_missing_reports") : Promise.resolve(null),
    profile.role === "owner"
      ? supabase.from("meetings").select("id", { count: "exact", head: true }).not("delete_requested_at", "is", null)
      : Promise.resolve(null),
    supabase.from("resource_links").select(LINK_SELECT).order("title"),
    isLeader ? supabase.from("roles_config").select("id, name") : Promise.resolve(null),
    // Presensi hari ini: milik sendiri (karyawan/manager) dan hitungan tim (Owner/Manager).
    wajibPresensi
      ? supabase.from("presensi").select("status, check_in_at, check_out_at").eq("user_id", profile.id).eq("attendance_date", today).maybeSingle()
      : Promise.resolve(null),
    isLeader ? supabase.from("presensi").select("user_id").eq("attendance_date", today).limit(1000) : Promise.resolve(null),
    isLeader ? supabase.from("users").select("id, created_at").eq("is_active", true).in("role", ["employee", "manager"]).limit(1000) : Promise.resolve(null),
    // Cuti/izin: gugur hari ini (diri sendiri), yang cuti hari ini di tim, dan pengajuan yang menunggu keputusan
    wajibPresensi ? supabase.rpc("excused_kind", { p_user: profile.id, p_date: today }) : Promise.resolve(null),
    isLeader
      ? supabase.from("leave_requests").select("user_id").eq("status", "approved").lte("start_date", today).gte("end_date", today).limit(1000)
      : Promise.resolve(null),
    isLeader
      ? supabase
          .from("leave_requests")
          .select("user_id, status, cancel_requested_at, cancel_outcome")
          .or("status.eq.pending,and(status.eq.approved,cancel_requested_at.not.is.null,cancel_outcome.is.null)")
          .limit(500)
      : Promise.resolve(null),
  ]);
  // Bila tabel tautan belum ada (atau gagal dibaca), bagian ini dilewati; Beranda tetap tampil.
  const links = linksRes.error ? null : ((linksRes.data ?? []) as unknown as ResourceLink[]);
  const reportAt = reportRes && !reportRes.error ? (reportRes.data?.updated_at ?? null) : undefined;
  const tasks = tasksRes.error ? null : ((tasksRes.data ?? []) as { due_date: string | null }[]);
  const overdue = tasks ? tasks.filter((t) => t.due_date && t.due_date < today).length : 0;
  const missing = missingRes && !missingRes.error ? ((missingRes.data ?? []) as unknown[]).length : null;
  const deleteRequests = deleteRes && !deleteRes.error ? (deleteRes.count ?? 0) : null;

  // Presensi: bila tabel belum ada atau gagal dibaca, kartunya dilewati.
  const myPres = myPresRes && !myPresRes.error ? { row: (myPresRes.data as { status: string; check_in_at: string; check_out_at: string | null } | null) ?? null } : null;
  const isSunday = new Date(`${today}T00:00:00Z`).getUTCDay() === 0;
  const excusedToday = excusedRes && !excusedRes.error && typeof excusedRes.data === "string" ? (excusedRes.data as string) : null;
  const onLeaveSet = new Set(
    leaveTodayRes && !leaveTodayRes.error && !isSunday ? ((leaveTodayRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id) : [],
  );
  const leaveWaiting = leaveOpenRes && !leaveOpenRes.error ? ((leaveOpenRes.data ?? []) as unknown[]).length : null;
  let presTim: { sudah: number; belum: number; cuti: number } | null = null;
  if (presTodayRes && peopleRes && !presTodayRes.error && !peopleRes.error) {
    const done = new Set(((presTodayRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const endOfDay = new Date(`${today}T23:59:59+07:00`).getTime();
    const people = ((peopleRes.data ?? []) as { id: string; created_at: string }[]).filter((p) => new Date(p.created_at).getTime() <= endOfDay);
    presTim = {
      sudah: people.filter((p) => done.has(p.id)).length,
      belum: people.filter((p) => !done.has(p.id) && !onLeaveSet.has(p.id)).length,
      cuti: people.filter((p) => !done.has(p.id) && onLeaveSet.has(p.id)).length,
    };
  }

  return (
    <div>
      {params.pesan === "password-tersimpan" && (
        <p role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Password berhasil disimpan.
        </p>
      )}
      <p className="text-sm text-zinc-600">{formatHariTanggal()}</p>
      <h1 className="text-2xl font-bold text-accent">Halo, {profile.full_name.split(" ")[0]}</h1>
      {!profile.position && profile.role !== "owner" && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Jabatan Anda belum diatur, sehingga form laporan belum bisa ditampilkan. Hubungi admin.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {reportAt !== undefined && (
          <Link
            href="/laporan"
            className={`rounded-xl border p-4 shadow-sm ${reportAt || excusedToday ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}
          >
            <p className="text-xs font-bold tracking-wide text-zinc-600 uppercase">Laporan hari ini</p>
            {!reportAt && excusedToday ? (
              <>
                <p className="mt-1 font-bold text-green-800">Tidak wajib hari ini</p>
                <p className="text-sm text-zinc-600">Anda {excusedToday === "sakit" ? "Sakit" : kindLabel(excusedToday)}, jadi daily report gugur.</p>
              </>
            ) : reportAt ? (
              <>
                <p className="mt-1 font-bold text-green-800">✓ Sudah tersimpan</p>
                <p className="text-sm text-zinc-600">Terakhir diperbarui pukul {formatJam(reportAt)} WIB. Ketuk untuk melanjutkan.</p>
              </>
            ) : (
              <>
                <p className="mt-1 font-bold text-amber-900">Belum diisi</p>
                <p className="text-sm text-zinc-600">Ketuk untuk mengisi laporan hari ini.</p>
              </>
            )}
          </Link>
        )}
        {myPres && (() => {
          const r = myPres.row;
          const noOut = !!r && !r.check_out_at && r.status !== "izin" && r.status !== "sakit";
          const leaveKind = !r && !isSunday && (excusedToday === "cuti" || excusedToday === "izin") ? excusedToday : null;
          const tone = leaveKind ? "border-green-300 bg-green-50" : !r ? "border-amber-300 bg-amber-50" : noOut ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50";
          return (
            <Link href="/presensi" className={`rounded-xl border p-4 shadow-sm ${tone}`}>
              <p className="text-xs font-bold tracking-wide text-zinc-600 uppercase">Presensi hari ini</p>
              {leaveKind ? (
                <>
                  <p className="mt-1 font-bold text-green-800">✓ Hari ini {kindLabel(leaveKind)} (disetujui)</p>
                  <p className="text-sm text-zinc-600">Tidak perlu presensi dan daily report.</p>
                </>
              ) : !r ? (
                <>
                  <p className="mt-1 font-bold text-amber-900">Belum Check-In</p>
                  <p className="text-sm text-zinc-600">Ketuk untuk Check-In.</p>
                </>
              ) : noOut ? (
                <>
                  <p className="mt-1 font-bold text-amber-900">Check-In {formatJam(r.check_in_at)} · belum Check-Out</p>
                  <p className="text-sm text-zinc-600">Ketuk untuk Check-Out saat pulang.</p>
                </>
              ) : (
                <>
                  <p className="mt-1 font-bold text-green-800">✓ {statusLabel(r.status)} · selesai</p>
                  <p className="text-sm text-zinc-600">Check-In {formatJam(r.check_in_at)}{r.check_out_at ? `, Check-Out ${formatJam(r.check_out_at)}` : ""}.</p>
                </>
              )}
            </Link>
          );
        })()}
        {presTim && (
          <Link
            href="/presensi/rekap"
            className={`rounded-xl border p-4 shadow-sm ${presTim.belum ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}
          >
            <p className="text-xs font-bold tracking-wide text-zinc-600 uppercase">Presensi tim hari ini</p>
            <p className={`mt-1 font-bold ${presTim.belum ? "text-amber-900" : "text-green-800"}`}>
              {presTim.belum === 0 ? "Semua sudah Check-In" : `${presTim.belum} orang belum Check-In`}
            </p>
            <p className="text-sm text-zinc-600">
              {presTim.sudah} sudah Check-In{presTim.cuti > 0 ? `, ${presTim.cuti} cuti/izin` : ""}. Ketuk untuk rekap.
            </p>
          </Link>
        )}
        {leaveWaiting !== null && leaveWaiting > 0 && (
          <Link href="/cuti/persetujuan" className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-bold tracking-wide text-zinc-600 uppercase">Cuti / Izin</p>
            <p className="mt-1 font-bold text-amber-900">{leaveWaiting} pengajuan menunggu keputusan</p>
            <p className="text-sm text-zinc-600">Termasuk pengajuan pembatalan. Ketuk untuk memproses.</p>
          </Link>
        )}
        {tasks && (
          <Link
            href="/tugas"
            className={`rounded-xl border p-4 shadow-sm ${overdue ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white"}`}
          >
            <p className="text-xs font-bold tracking-wide text-zinc-600 uppercase">Tugas saya</p>
            <p className={`mt-1 font-bold ${overdue ? "text-red-800" : "text-accent"}`}>
              {tasks.length === 0 ? "Tidak ada tugas terbuka" : `${tasks.length} tugas belum selesai`}
            </p>
            {overdue > 0 && <p className="text-sm font-bold text-red-700">{overdue} lewat tenggat</p>}
          </Link>
        )}
        {missing !== null && (
          <Link
            href="/dashboard"
            className={`rounded-xl border p-4 shadow-sm ${missing ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}
          >
            <p className="text-xs font-bold tracking-wide text-zinc-600 uppercase">Tim hari ini</p>
            <p className={`mt-1 font-bold ${missing ? "text-amber-900" : "text-green-800"}`}>
              {missing === 0 ? "Semua sudah mengisi" : `${missing} orang belum mengisi`}
            </p>
            <p className="text-sm text-zinc-600">Ketuk untuk melihat dashboard.</p>
          </Link>
        )}
        {deleteRequests !== null && deleteRequests > 0 && (
          <Link href="/notulensi?status=hapus" className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm">
            <p className="text-xs font-bold tracking-wide text-zinc-600 uppercase">Menunggu persetujuan Anda</p>
            <p className="mt-1 font-bold text-red-800">{deleteRequests} permintaan hapus notulensi</p>
          </Link>
        )}
      </div>

      {isLeader && (
        <div className="mt-6">
          <Suspense
            fallback={
              <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 shadow-sm">
                Memuat dashboard…
              </div>
            }
          >
            <DashboardSection
              profile={profile}
              periode={parsePeriode(params.periode)}
              company={typeof params.company === "string" ? params.company : ""}
            />
          </Suspense>
        </div>
      )}

      {links && (links.length > 0 || isLeader) && (
        <section id="tautan" className="mt-6 scroll-mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-accent">Tautan penting</h2>
            {isLeader && (
              <Link href="/tautan" className="text-sm font-bold text-accent underline decoration-gold underline-offset-2">
                Kelola tautan →
              </Link>
            )}
          </div>
          {links.length > 0 ? (
            <LinkGroups links={links} showScope={isLeader} positionNames={positionNameMap(posRes?.data as { id: number; name: string }[] | null)} />
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white/60 p-4 text-sm text-zinc-600">
              Belum ada tautan. Tambahkan link tracker, aset, dan SOP lewat <b>Kelola tautan</b> agar tim tidak perlu mencari-cari.
            </p>
          )}
        </section>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const body = (
            <>
              <p className="flex items-center justify-between gap-2 font-bold">
                {item.label}
                {!item.ready && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-500">
                    Segera hadir
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
            </>
          );
          return (
            <li key={item.href}>
              {item.ready ? (
                <Link
                  href={item.href}
                  className="block h-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-gold hover:shadow-md"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-xl border border-dashed border-zinc-300 bg-white/60 p-4 text-zinc-500">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center text-sm">
        <Link href="/atur-password" className="text-accent hover:underline">
          Ganti password
        </Link>
      </p>
    </div>
  );
}
