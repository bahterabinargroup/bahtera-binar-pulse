import { redirect } from "next/navigation";
import { ActionButton } from "@/components/owner/ActionButton";
import { ActionForm } from "@/components/owner/ActionForm";
import { PointForm } from "@/components/presensi/PointForm";
import { cardCls, inputCls } from "@/components/owner/ui";
import type { PointKind } from "@/lib/geo";
import { mapsUrl } from "@/lib/presensi";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { deletePoint, setRadius } from "./actions";

type Point = { id: string; company_id: string; name: string; lat: number | string; lng: number | string; radius_m: number; is_active: boolean; kind: PointKind };
type Comp = { id: string; name: string };

// Titik lokasi untuk aturan radius: titik kantor (WFO, hanya Owner) dan titik tujuan Tugas Luar (Owner dan Manager company-nya).
export default async function TitikAbsenPage() {
  const { profile } = await getCurrentUser();
  if (!profile || (profile.role !== "owner" && profile.role !== "manager")) redirect("/");
  const isOwner = profile.role === "owner";

  const supabase = await createClient();
  const [ptRes, compRes] = await Promise.all([
    supabase.from("presensi_locations").select("id, company_id, name, lat, lng, radius_m, is_active, kind").order("name"),
    supabase.from("companies").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (ptRes.error && ["42P01", "PGRST205", "42703", "PGRST204"].includes(ptRes.error.code ?? "")) {
    return (
      <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Fitur titik belum aktif: jalankan <code>supabase/021_titik_absen.sql</code> dan <code>supabase/022_titik_tujuan.sql</code>.
      </p>
    );
  }
  if (ptRes.error) throw new Error(`Gagal memuat titik: ${ptRes.error.message}`);
  if (compRes.error) throw new Error(compRes.error.message);
  const points = (ptRes.data ?? []) as Point[];
  // Manager hanya mengelola company-nya.
  const companies = ((compRes.data ?? []) as Comp[]).filter((c) => isOwner || c.id === profile.company?.id);
  const kantor = points.filter((p) => p.kind === "kantor");
  const tujuan = points.filter((p) => p.kind === "tujuan");
  const noKantor = companies.filter((c) => !kantor.some((p) => p.company_id === c.id && p.is_active));
  const noTujuan = companies.filter((c) => !tujuan.some((p) => p.company_id === c.id && p.is_active));

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Titik Absen</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Check-In dan Check-Out hanya bisa dilakukan di dalam radius titik: <b>WFO</b> di titik kantor, <b>Tugas Luar</b> di titik tujuan yang sudah didaftarkan di sini. Izin dan Sakit tidak dibatasi.
      </p>

      <section aria-labelledby="tujuan" className="mt-6">
        <h2 id="tujuan" className="text-xl font-bold text-accent">Titik tujuan Tugas Luar</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Daftarkan tempat tujuan (mis. &quot;Redigma&quot;) <b>sebelum</b> karyawan berangkat. Karyawan yang Tugas Luar ke tempat yang belum terdaftar akan ditolak. {isOwner ? "Owner dan Manager company-nya" : "Anda"} boleh menambah tujuan baru.
        </p>
        {noTujuan.length > 0 && (
          <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Belum punya titik tujuan (Tugas Luar belum dibatasi): <b>{noTujuan.map((c) => c.name).join(", ")}</b>. Aturan baru berlaku setelah company punya minimal satu titik tujuan, dan sejak itu Tugas Luar hanya bisa di titik terdaftar.
          </p>
        )}
        <PointForm companies={companies} kind="tujuan" fixedCompany={!isOwner} />
        <PointList points={tujuan} companies={companies} kind="tujuan" empty="Belum ada titik tujuan." />
      </section>

      {isOwner && (
        <section aria-labelledby="kantor" className="mt-10">
          <h2 id="kantor" className="text-xl font-bold text-accent">Titik absen kantor (WFO)</h2>
          <p className="mt-1 text-sm text-zinc-600">Hanya Owner yang mengelola titik kantor.</p>
          {noKantor.length > 0 && (
            <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Belum punya titik absen kantor (WFO belum dibatasi): <b>{noKantor.map((c) => c.name).join(", ")}</b>. Aturan radius baru berlaku setelah company punya minimal satu titik.
            </p>
          )}
          <PointForm companies={companies} kind="kantor" />
          <PointList points={kantor} companies={companies} kind="kantor" empty="Belum ada titik absen kantor." />
        </section>
      )}
    </div>
  );
}

function PointList({ points, companies, kind, empty }: { points: Point[]; companies: Comp[]; kind: PointKind; empty: string }) {
  const tujuan = kind === "tujuan";
  if (points.length === 0) return <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm">{empty}</p>;
  return (
    <ul className="mt-4 space-y-3">
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
                      <ActionButton
                        run={deletePoint.bind(null, p.id)}
                        label="Hapus"
                        tone="danger"
                        confirm={tujuan ? `Hapus tujuan "${p.name}"? Jika ini tujuan terakhir company, aturan Tugas Luar berhenti berlaku.` : `Hapus titik "${p.name}"? Jika ini titik kantor terakhir company, aturan radius WFO berhenti berlaku.`}
                      />
                    </span>
                  </li>
                ))}
            </ul>
          </li>
        ))}
    </ul>
  );
}
