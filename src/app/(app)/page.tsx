import Link from "next/link";
import { Suspense } from "react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { parsePeriode } from "@/lib/dashboard";
import { formatHariTanggal, formatJam, todayJakarta } from "@/lib/date";
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
  const [reportRes, tasksRes, missingRes, deleteRes, linksRes, posRes] = await Promise.all([
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
  ]);
  // Bila tabel tautan belum ada (atau gagal dibaca), bagian ini dilewati; Beranda tetap tampil.
  const links = linksRes.error ? null : ((linksRes.data ?? []) as unknown as ResourceLink[]);
  const reportAt = reportRes && !reportRes.error ? (reportRes.data?.updated_at ?? null) : undefined;
  const tasks = tasksRes.error ? null : ((tasksRes.data ?? []) as { due_date: string | null }[]);
  const overdue = tasks ? tasks.filter((t) => t.due_date && t.due_date < today).length : 0;
  const missing = missingRes && !missingRes.error ? ((missingRes.data ?? []) as unknown[]).length : null;
  const deleteRequests = deleteRes && !deleteRes.error ? (deleteRes.count ?? 0) : null;

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
            className={`rounded-xl border p-4 shadow-sm ${reportAt ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}
          >
            <p className="text-xs font-bold tracking-wide text-zinc-600 uppercase">Laporan hari ini</p>
            {reportAt ? (
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
