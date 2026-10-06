import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/report/ReportForm";
import { dateFromYmd, formatHariTanggal, formatJam, todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import type { ReportData } from "@/lib/report/form-state";
import type { FormTemplate } from "@/lib/report/template";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Detail laporan sendiri, hanya baca. Form digambar dengan renderer yang sama.
export default async function RiwayatDetailPage({ params }: PageProps<"/riwayat/[id]">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("daily_reports")
    .select(
      "id, report_date, position_id, activities, performance_metrics, insights, obstacles, next_plan, evidence_links, updated_at, position:roles_config(form_template)",
    )
    .eq("id", id)
    .eq("user_id", profile.id) // halaman ini hanya untuk laporan milik sendiri
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat laporan: ${error.message}`);
  if (!report) notFound();

  const template = (report.position as unknown as { form_template: FormTemplate } | null)?.form_template;
  const isToday = report.report_date === todayJakarta();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/riwayat" className="text-sm font-bold text-accent hover:underline">
          ← Semua riwayat
        </Link>
        {isToday ? (
          <Link
            href="/laporan"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110"
          >
            Edit laporan hari ini
          </Link>
        ) : (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold text-zinc-700">
            🔒 Terkunci · terakhir diperbarui {formatJam(report.updated_at)} WIB
          </span>
        )}
      </div>

      {template ? (
        <ReportForm
          template={template}
          name={profile.full_name}
          dateLabel={formatHariTanggal(dateFromYmd(report.report_date))}
          reportDate={report.report_date}
          initialReport={report as unknown as ReportData & { id: string; updated_at: string }}
          mode="view"
        />
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Form untuk laporan ini tidak ditemukan (jabatan sudah dihapus). Hubungi admin.
        </p>
      )}
    </div>
  );
}
