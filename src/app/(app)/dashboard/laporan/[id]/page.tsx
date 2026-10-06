import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReportForm } from "@/components/report/ReportForm";
import { dateFromYmd, formatHariTanggal, formatJam, todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import type { ReportData } from "@/lib/report/form-state";
import type { FormTemplate } from "@/lib/report/template";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Detail laporan anggota tim, hanya baca. RLS: Manager se-company, Owner semua.
export default async function LaporanAnggotaPage({ params, searchParams }: PageProps<"/dashboard/laporan/[id]">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (profile.role === "employee") redirect("/");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("daily_reports")
    .select(
      "id, report_date, activities, performance_metrics, insights, obstacles, next_plan, evidence_links, updated_at, user:users(full_name), company:companies(name), position:roles_config(name, form_template)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat laporan: ${error.message}`);
  if (!report) notFound();

  const user = report.user as unknown as { full_name: string } | null;
  const company = report.company as unknown as { name: string } | null;
  const position = report.position as unknown as { name: string; form_template: FormTemplate } | null;
  const locked = report.report_date !== todayJakarta();
  const isOwner = profile.role === "owner";
  const correcting = isOwner && (await searchParams).koreksi === "1";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/dashboard?tanggal=${report.report_date}`} className="text-sm font-bold text-accent hover:underline">
          ← Kembali ke Dashboard
        </Link>
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold text-zinc-700">
            {locked ? "🔒 Terkunci" : "Hari ini (masih bisa diubah pemiliknya)"} · diperbarui {formatJam(report.updated_at)} WIB
          </span>
          {isOwner &&
            (correcting ? (
              <Link href={`/dashboard/laporan/${report.id}`} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-bold">
                Selesai koreksi
              </Link>
            ) : (
              <Link href={`/dashboard/laporan/${report.id}?koreksi=1`} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white">
                Koreksi (Owner)
              </Link>
            ))}
        </span>
      </div>
      {correcting && (
        <p className="mb-3 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
          <b>Mode koreksi Owner.</b> Perubahan menimpa isi laporan karyawan ini. Tekan Simpan setelah selesai.
        </p>
      )}
      <p className="mb-3 text-sm text-zinc-600">
        Laporan <b>{user?.full_name}</b>
        {position ? ` · ${position.name}` : ""}
        {company ? ` · ${company.name}` : ""}
      </p>
      {position?.form_template ? (
        <ReportForm
          template={position.form_template}
          name={user?.full_name ?? "—"}
          dateLabel={formatHariTanggal(dateFromYmd(report.report_date))}
          reportDate={report.report_date}
          initialReport={report as unknown as ReportData & { id: string; updated_at: string }}
          mode={correcting ? "correct" : "view"}
        />
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Form untuk laporan ini tidak ditemukan.</p>
      )}
    </div>
  );
}
