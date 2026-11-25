import { redirect } from "next/navigation";
import { WorkStartRow } from "@/components/owner/WorkStartRow";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

type Row = { id: string; full_name: string; role: string; work_start_date: string | null; company: { name: string } | null; position: { name: string } | null };

// Tanggal mulai kerja karyawan dan Lead (menentukan hari reset kuota cuti/izin). Owner semua company, Manager company-nya.
export default async function MulaiKerjaPage() {
  const { profile } = await getCurrentUser();
  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) redirect("/");
  const supabase = await createClient();
  let q = supabase
    .from("users")
    .select("id, full_name, role, work_start_date, company:companies(name), position:roles_config(name)")
    .in("role", ["employee", "lead"])
    .eq("is_active", true)
    .order("full_name")
    .limit(500);
  if (profile.role === "manager" && profile.company) q = q.eq("company_id", profile.company.id);
  const { data, error } = await q;
  if (error) {
    if (error.code === "42703") {
      return <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Fitur belum aktif: jalankan <code>supabase/023_tanggal_mulai_kerja.sql</code> dan <code>024</code>.</p>;
    }
    throw new Error(`Gagal memuat karyawan: ${error.message}`);
  }
  const rows = (data ?? []) as unknown as Row[];
  const kosong = rows.filter((r) => !r.work_start_date).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Tanggal Mulai Kerja</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Isi tanggal masuk tiap karyawan. Hari dalam bulannya menjadi hari reset kuota cuti/izin (masuk tanggal 21 = kuota direset tiap tanggal 21). Yang dikosongkan direset tanggal 1. Perubahan berlaku untuk pengajuan baru.
      </p>
      {kosong > 0 && <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{kosong} dari {rows.length} orang belum diisi tanggal mulai kerjanya.</p>}
      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada karyawan.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white px-4 shadow-sm">
          {rows.map((r) => (
            <WorkStartRow key={r.id} id={r.id} name={r.full_name} detail={`${r.position?.name ?? "Tanpa jabatan"}${profile.role === "owner" ? ` · ${r.company?.name ?? "—"}` : ""}${r.role === "lead" ? " · Lead" : ""}`} initial={r.work_start_date} />
          ))}
        </ul>
      )}
    </div>
  );
}
