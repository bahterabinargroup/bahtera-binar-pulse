import Link from "next/link";
import { ReportForm } from "@/components/report/ReportForm";
import { dateFromYmd, formatHariTanggal, todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import { extractPrefill, type ReportData } from "@/lib/report/form-state";
import type { FormTemplate } from "@/lib/report/template";
import { createClient } from "@/lib/supabase/server";

export default async function LaporanHariIniPage() {
  const { profile } = await getCurrentUser();
  if (!profile) return null; // ditangani layout

  const today = todayJakarta();
  const supabase = await createClient();

  const { data: report, error: reportError } = await supabase
    .from("daily_reports")
    .select("id, position_id, activities, performance_metrics, insights, obstacles, next_plan, evidence_links, updated_at")
    .eq("user_id", profile.id)
    .eq("report_date", today)
    .maybeSingle();
  if (reportError) throw new Error(`Gagal memuat laporan: ${reportError.message}`);

  // Laporan yang sudah ada memakai jabatan saat laporan dibuat (snapshot).
  const positionId = report?.position_id ?? profile.position?.id;
  if (!positionId) {
    return (
      <Notice>
        Jabatan Anda belum diatur, sehingga form laporan belum bisa ditampilkan. Hubungi admin.
        {profile.role === "owner" && (
          <>
            {" "}
            Sebagai Owner, Anda bisa melihat semua form lewat{" "}
            <Link href="/laporan/pratinjau" className="font-bold text-accent underline">
              Pratinjau Form
            </Link>
            .
          </>
        )}
      </Notice>
    );
  }

  const { data: position, error: posError } = await supabase
    .from("roles_config")
    .select("code, name, form_template")
    .eq("id", positionId)
    .single();
  if (posError) throw new Error(`Gagal memuat form: ${posError.message}`);

  const template = position.form_template as FormTemplate;

  // Laporan baru: isi otomatis kolom yang biasanya sama dari laporan terakhir.
  let prefill = null;
  if (!report) {
    const { data: last } = await supabase
      .from("daily_reports")
      .select("performance_metrics")
      .eq("user_id", profile.id)
      .lt("report_date", today)
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) prefill = extractPrefill(template, last.performance_metrics);
  }

  return (
    <ReportForm
      key={report?.id ?? "baru"}
      template={template}
      prefill={prefill}
      name={profile.full_name}
      dateLabel={formatHariTanggal(dateFromYmd(today))}
      reportDate={today}
      initialReport={report as (ReportData & { id: string; updated_at: string }) | null}
    />
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{children}</p>
  );
}
