import Link from "next/link";
import { Suspense } from "react";
import { ActionCard, AttentionList, ClockIcon, DocIcon, type Attention } from "@/components/home/HomeBlocks";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { parsePeriode } from "@/lib/dashboard";
import { addDays, formatHariTanggal, formatJam, todayJakarta } from "@/lib/date";
import { kindLabel } from "@/lib/leave";
import { statusLabel } from "@/lib/presensi";
import { LinkGroups } from "@/components/links/LinkGroups";
import { LINK_SELECT, positionNameMap, type ResourceLink } from "@/lib/links";
import { canViewTeam, getCurrentUser, isManagerial, leadPositionIds } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { countLeaveWaiting } from "@/lib/nav-badges";

export default async function BerandaPage({ searchParams }: PageProps<"/">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null; // ditangani layout
  const params = await searchParams;

  // Ringkasan hari ini. Bila satu pertanyaan ke database gagal, kartunya dilewati (Beranda tetap tampil).
  const supabase = await createClient();
  const today = todayJakarta();
  const isLeader = isManagerial(profile.role); // Owner/Manager: dashboard, kelola tautan, persetujuan
  const viewsTeam = canViewTeam(profile.role); // + Lead (hanya melihat divisinya)
  const hasForm = !!profile.position;
  const wajibPresensi = profile.role !== "owner";
  const [reportRes, tasksRes, missingRes, deleteRes, linksRes, posRes, myPresRes, presTodayRes, peopleRes, excusedRes, leaveTodayRes, leaveOpenRes, aiOpenRes, aiLateRes, kendalaRes, handledRes] = await Promise.all([
    hasForm
      ? supabase.from("daily_reports").select("updated_at").eq("user_id", profile.id).eq("report_date", today).maybeSingle()
      : Promise.resolve(null),
    supabase.rpc("get_my_action_items"),
    viewsTeam ? supabase.rpc("get_missing_reports") : Promise.resolve(null),
    profile.role === "owner"
      ? supabase.from("meetings").select("id", { count: "exact", head: true }).not("delete_requested_at", "is", null)
      : Promise.resolve(null),
    supabase.from("resource_links").select(LINK_SELECT).order("title"),
    isLeader ? supabase.from("roles_config").select("id, name") : Promise.resolve(null),
    // Presensi hari ini: milik sendiri (karyawan/manager) dan hitungan tim (Owner/Manager).
    wajibPresensi
      ? supabase.from("presensi").select("status, check_in_at, check_out_at").eq("user_id", profile.id).eq("attendance_date", today).maybeSingle()
      : Promise.resolve(null),
    viewsTeam ? supabase.from("presensi").select("user_id").eq("attendance_date", today).limit(1000) : Promise.resolve(null),
    viewsTeam
      ? (() => {
          const q = supabase.from("users").select("id, created_at").eq("is_active", true).limit(1000);
          // Lead: hanya karyawan biasa di divisinya (dan divisi tambahan)
          return profile.role === "lead" ? q.eq("role", "employee").in("position_id", leadPositionIds(profile)) : q.in("role", ["employee", "lead", "manager"]);
        })()
      : Promise.resolve(null),
    // Cuti/izin: gugur hari ini (diri sendiri), yang cuti hari ini di tim, dan pengajuan yang menunggu keputusan
    wajibPresensi ? supabase.rpc("excused_kind", { p_user: profile.id, p_date: today }) : Promise.resolve(null),
    viewsTeam
      ? supabase.from("leave_requests").select("user_id").eq("status", "approved").lte("start_date", today).gte("end_date", today).limit(1000)
      : Promise.resolve(null),
    isLeader ? countLeaveWaiting(supabase, profile, today) : Promise.resolve(null),
    // Pengelola: ringkasan tindak lanjut notulensi dan kendala 7 hari terakhir yang belum ditandai ditangani
    isLeader ? supabase.from("meeting_action_items").select("id", { count: "exact", head: true }).neq("status", "done") : Promise.resolve(null),
    isLeader ? supabase.from("meeting_action_items").select("id", { count: "exact", head: true }).neq("status", "done").lt("due_date", today) : Promise.resolve(null),
    isLeader
      ? supabase.from("daily_reports").select("id").gte("report_date", addDays(today, -6)).lte("report_date", today).not("obstacles", "is", null).neq("obstacles", "").limit(1000)
      : Promise.resolve(null),
    isLeader ? supabase.from("report_followups").select("report_id").limit(5000) : Promise.resolve(null),
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
  const aiOpen = aiOpenRes && !aiOpenRes.error ? (aiOpenRes.count ?? 0) : null;
  const aiLate = aiLateRes && !aiLateRes.error ? (aiLateRes.count ?? 0) : 0;
  const handledIds = new Set(handledRes && !handledRes.error ? ((handledRes.data ?? []) as { report_id: string }[]).map((r) => r.report_id) : []);
  const kendalaOpen = kendalaRes && !kendalaRes.error ? ((kendalaRes.data ?? []) as { id: string }[]).filter((r) => !handledIds.has(r.id)).length : null;
  const leaveWaiting = leaveOpenRes ?? null;
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

  // ---- Kartu aksi utama: keadaan + satu tombol ajakan ----
  const reportCard: Omit<Parameters<typeof ActionCard>[0], "href" | "icon" | "title"> | null =
    reportAt === undefined
      ? null
      : !reportAt && excusedToday
        ? { status: "Tidak wajib hari ini", detail: `Anda ${excusedToday === "sakit" ? "Sakit" : kindLabel(excusedToday)}, jadi daily report gugur.`, cta: "Lihat form", todo: false }
        : reportAt
          ? { status: "Sudah tersimpan", detail: `Diperbarui pukul ${formatJam(reportAt)} WIB`, cta: "Lanjutkan mengisi", todo: false }
          : { status: "Belum diisi", detail: "Boleh diisi sedikit demi sedikit; tersimpan otomatis.", cta: "Isi laporan", todo: true };

  const presCard: Omit<Parameters<typeof ActionCard>[0], "href" | "icon" | "title"> | null = (() => {
    if (!myPres) return null;
    const r = myPres.row;
    const noOut = !!r && !r.check_out_at && r.status !== "izin" && r.status !== "sakit";
    const leaveKind = !r && !isSunday && (excusedToday === "cuti" || excusedToday === "izin") ? excusedToday : null;
    if (leaveKind) return { status: `Hari ini ${kindLabel(leaveKind)} (disetujui)`, detail: "Tidak perlu presensi dan daily report.", cta: "Lihat", todo: false };
    if (!r) return { status: "Belum Check-In", detail: "Check-In saat Anda mulai bekerja.", cta: "Check-In sekarang", todo: true };
    if (noOut) return { status: `Check-In pukul ${formatJam(r.check_in_at)}`, detail: "Belum Check-Out. Lakukan saat pulang.", cta: "Check-Out", todo: true };
    return {
      status: `${statusLabel(r.status)} · selesai`,
      detail: `Check-In ${formatJam(r.check_in_at)}${r.check_out_at ? `, Check-Out ${formatJam(r.check_out_at)}` : ""}`,
      cta: "Lihat",
      todo: false,
    };
  })();

  // ---- "Perlu perhatian Anda": hanya yang butuh tindakan ----
  const attention: Attention[] = [];
  if (leaveWaiting) attention.push({ key: "cuti", href: "/cuti/persetujuan", text: `${leaveWaiting} pengajuan cuti/izin menunggu keputusan`, detail: "Termasuk pengajuan pembatalan", tone: "warn", count: leaveWaiting });
  if (deleteRequests) attention.push({ key: "hapus", href: "/notulensi?status=hapus", text: `${deleteRequests} permintaan hapus notulensi menunggu persetujuan`, tone: "warn", count: deleteRequests });
  if (presTim && presTim.belum > 0)
    attention.push({ key: "presensi-tim", href: "/presensi/rekap", text: `${presTim.belum} orang belum Check-In hari ini`, detail: `${presTim.sudah} sudah Check-In${presTim.cuti > 0 ? `, ${presTim.cuti} cuti/izin` : ""}`, tone: "warn", count: presTim.belum });
  if (missing) attention.push({ key: "belum-lapor", href: "/dashboard", text: `${missing} orang belum mengisi laporan hari ini`, tone: "warn", count: missing });
  if (kendalaOpen) attention.push({ key: "kendala", href: "/pantauan", text: `${kendalaOpen} kendala belum ditangani`, detail: "Dari laporan 7 hari terakhir", tone: "warn", count: kendalaOpen });
  if (aiOpen)
    attention.push({
      key: "tindak-lanjut",
      href: "/tindak-lanjut",
      text: aiLate ? `${aiLate} tindak lanjut notulensi lewat tenggat` : `${aiOpen} tindak lanjut notulensi belum selesai`,
      detail: aiLate ? `${aiOpen} belum selesai seluruhnya` : undefined,
      tone: aiLate ? "danger" : "info",
      count: aiLate || aiOpen,
    });
  if (tasks && tasks.length > 0)
    attention.push({
      key: "tugas",
      href: "/tugas",
      text: overdue ? `${overdue} tugas Anda lewat tenggat` : `${tasks.length} tugas Anda belum selesai`,
      detail: overdue ? `${tasks.length} belum selesai seluruhnya` : undefined,
      tone: overdue ? "danger" : "info",
      count: overdue || tasks.length,
    });

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

      {(presCard || reportCard) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {presCard && <ActionCard href="/presensi" icon={<ClockIcon />} title="Presensi hari ini" {...presCard} />}
          {reportCard && <ActionCard href="/laporan" icon={<DocIcon />} title="Laporan hari ini" {...reportCard} />}
        </div>
      )}

      <div className="mt-5">
        <AttentionList items={attention} />
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


      <p className="mt-8 text-center text-sm">
        <Link href="/atur-password" className="text-accent hover:underline">
          Ganti password
        </Link>
      </p>
    </div>
  );
}
