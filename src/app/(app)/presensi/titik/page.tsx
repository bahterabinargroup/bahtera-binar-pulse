import { redirect } from "next/navigation";
import { ActionButton } from "@/components/owner/ActionButton";
import { ActionForm } from "@/components/owner/ActionForm";
import { PointForm } from "@/components/presensi/PointForm";
import { cardCls, inputCls } from "@/components/owner/ui";
import { mapsUrl } from "@/lib/presensi";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { deletePoint, setRadius } from "./actions";

type Point = { id: string; company_id: string; name: string; lat: number | string; lng: number | string; radius_m: number; is_active: boolean };

// Titik absen per company untuk aturan radius WFO. Hanya Owner.
export default async function TitikAbsenPage() {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role !== "owner") redirect("/");

  const supabase = await createClient();
  const [ptRes, compRes] = await Promise.all([
    supabase.from("presensi_locations").select("id, company_id, name, lat, lng, radius_m, is_active").order("name"),
    supabase.from("companies").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (ptRes.error?.code === "42P01" || ptRes.error?.code === "PGRST205") {
    return (
      <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Fitur titik absen belum aktif: jalankan <code>supabase/021_titik_absen.sql</code>.
      </p>
    );
  }
  if (ptRes.error) throw new Error(`Gagal memuat titik absen: ${ptRes.error.message}`);
  if (compRes.error) throw new Error(compRes.error.message);
  const points = (ptRes.data ?? []) as Point[];
  const companies = (compRes.data ?? []) as { id: string; name: string }[];
  const without = companies.filter((c) => !points.some((p) => p.company_id === c.id && p.is_active));

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Titik Absen</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Check-In dan Check-Out <b>WFO</b> hanya bisa dilakukan di dalam radius dari salah satu titik company karyawan. Tugas Luar, Izin, dan Sakit tidak dibatasi.
      </p>

      {without.length > 0 && (
        <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Belum punya titik absen (WFO belum dibatasi): <b>{without.map((c) => c.name).join(", ")}</b>. Aturan radius baru berlaku setelah company punya minimal satu titik.
        </p>
      )}

      <PointForm companies={companies} />

      <h2 className="mt-6 text-lg font-bold">Daftar titik</h2>
      {points.length === 0 ? (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada titik absen.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {companies
            .filter((c) => points.some((p) => p.company_id === c.id))
            .map((c) => (
              <li key={c.id}>
                <p className="text-sm font-bold">{c.name}</p>
                <ul className="mt-1 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm shadow-sm">
                  {points
                    .filter((p) => p.company_id === c.id)
                    .map((p) => (
                      <li key={p.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3 rounded-none border-0 shadow-none`}>
                        <span>
                          <b>{p.name}</b>
                          <span className="text-zinc-600"> · {Number(p.lat).toFixed(6)}, {Number(p.lng).toFixed(6)} · </span>
                          <a href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">Lihat di peta</a>
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <ActionForm action={setRadius} submitLabel="Simpan radius" className="flex items-center gap-2">
                            <input type="hidden" name="id" value={p.id} />
                            <label className="flex items-center gap-1 text-xs font-bold">
                              Radius
                              <input name="radius_m" type="number" min={5} max={500} defaultValue={p.radius_m} className={`${inputCls} mt-0 w-20`} /> m
                            </label>
                          </ActionForm>
                          <ActionButton run={deletePoint.bind(null, p.id)} label="Hapus" tone="danger" confirm={`Hapus titik "${p.name}"? Jika ini titik terakhir company, aturan radius berhenti berlaku.`} />
                        </span>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
