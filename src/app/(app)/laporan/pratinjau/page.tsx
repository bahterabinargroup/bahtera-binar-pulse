import Link from "next/link";
import { redirect } from "next/navigation";
import { ReportForm } from "@/components/report/ReportForm";
import { dateFromYmd, formatHariTanggal, todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import type { FormTemplate } from "@/lib/report/template";
import { createClient } from "@/lib/supabase/server";

// Khusus Owner: melihat form setiap jabatan tanpa menyimpan apa pun,
// untuk mencocokkan tampilan dengan PDF contoh.
export default async function PratinjauFormPage({ searchParams }: PageProps<"/laporan/pratinjau">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (profile.role !== "owner") redirect("/laporan");

  const supabase = await createClient();
  const { data: positions, error } = await supabase
    .from("roles_config")
    .select("code, name, form_template")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`Gagal memuat daftar jabatan: ${error.message}`);

  const params = await searchParams;
  const selected = positions.find((p) => p.code === params.jabatan) ?? positions[0];
  const today = todayJakarta();

  return (
    <div>
      <p className="mb-3 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
        <b>Mode pratinjau.</b> Isian di sini tidak disimpan. Pilih jabatan untuk melihat form-nya.
      </p>
      <nav className="mb-4 flex flex-wrap gap-2">
        {positions.map((p) => (
          <Link
            key={p.code}
            href={`/laporan/pratinjau?jabatan=${p.code}`}
            className={`rounded-full border px-3 py-1 text-sm font-bold ${
              p.code === selected?.code ? "border-accent bg-accent text-white" : "border-zinc-300 bg-white"
            }`}
          >
            {p.name}
          </Link>
        ))}
      </nav>
      {selected && (
        <ReportForm
          key={selected.code}
          template={selected.form_template as FormTemplate}
          name={profile.full_name}
          dateLabel={formatHariTanggal(dateFromYmd(today))}
          reportDate={today}
          initialReport={null}
          mode="preview"
        />
      )}
    </div>
  );
}
