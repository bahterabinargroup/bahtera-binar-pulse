import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkForm, UnmarkForm } from "@/components/pantauan/HandleForms";
import { cardCls, inputCls } from "@/components/owner/ui";
import { PERIODE_LABEL, type Periode } from "@/lib/dashboard";
import { fmtTanggal } from "@/lib/leave";
import { loadPantauan, parseFilters } from "@/lib/pantauan";
import { getCurrentUser, isManagerial } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

// Pantauan kendala dan insight dari laporan harian semua divisi. Data disaring RLS:
// Owner semua company, Manager company-nya, Lead hanya divisinya (hanya melihat). Hanya Owner/Manager bisa menandai.
export default async function PantauanPage({ searchParams }: PageProps<"/pantauan">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (profile.role === "employee") redirect("/");
  const isOwner = profile.role === "owner";
  const canMark = isManagerial(profile.role);

  const f = parseFilters(await searchParams, isOwner);
  const supabase = await createClient();
  const [loaded, posRes, compRes] = await Promise.all([
    loadPantauan(supabase, profile, f),
    supabase.from("roles_config").select("id, name").eq("is_active", true).order("sort_order"),
    isOwner ? supabase.from("companies").select("id, name").order("name") : Promise.resolve({ data: null }),
  ]);
  const { items, range, truncated } = loaded;
  const positions = (posRes.data ?? []) as { id: number; name: string }[];
  const companies = compRes.data as { id: string; name: string }[] | null;

  // Ringkasan per divisi
  const byDiv = new Map<string, { kendala: number; belum: number; insight: number }>();
  for (const it of items) {
    const g = byDiv.get(it.positionName) ?? { kendala: 0, belum: 0, insight: 0 };
    if (it.kendala) {
      g.kendala++;
      if (!it.handled) g.belum++;
    }
    if (it.insight) g.insight++;
    byDiv.set(it.positionName, g);
  }
  const summary = [...byDiv.entries()].sort((a, b) => b[1].kendala - a[1].kendala);

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ periode: f.periode, jenis: f.jenis, status: f.status, divisi: f.divisi, company: f.company, q: f.q, ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return p.toString();
  };
  const pill = (on: boolean) => `rounded-full px-3 py-1 text-sm font-bold ${on ? "bg-accent text-white" : "border border-zinc-300 bg-white text-zinc-700"}`;
  const rangeText = range.from === range.to ? fmtTanggal(range.from) : `${fmtTanggal(range.from)} – ${fmtTanggal(range.to)}`;
  const belumTotal = items.filter((i) => i.kendala && !i.handled).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Pantauan Kendala dan Insight</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Semua kendala dan insight yang ditulis di laporan harian, dalam satu daftar. {isOwner ? "Semua company." : profile.role === "lead" ? "Karyawan di divisi Anda (hanya melihat)." : "Company Anda."}
      </p>

      <nav aria-label="Periode" className="mt-3 flex flex-wrap gap-1">
        {(Object.keys(PERIODE_LABEL) as Periode[]).map((p) => (
          <Link key={p} href={`/pantauan?${qs({ periode: p })}`} className={pill(p === f.periode)}>{PERIODE_LABEL[p]}</Link>
        ))}
      </nav>

      <form action="/pantauan" className={`${cardCls} mt-3 flex flex-wrap items-end gap-2 text-sm`}>
        <input type="hidden" name="periode" value={f.periode} />
        <label className="text-xs font-bold">Tampilkan
          <select name="jenis" defaultValue={f.jenis} className={inputCls}>
            <option value="semua">Kendala dan insight</option>
            <option value="kendala">Hanya kendala</option>
            <option value="insight">Hanya insight</option>
          </select>
        </label>
        <label className="text-xs font-bold">Status
          <select name="status" defaultValue={f.status} className={inputCls}>
            <option value="belum">Belum ditangani</option>
            <option value="sudah">Sudah ditangani</option>
            <option value="semua">Semua</option>
          </select>
        </label>
        <label className="text-xs font-bold">Divisi
          <select name="divisi" defaultValue={f.divisi} className={inputCls}>
            <option value="">Semua divisi</option>
            {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </label>
        {isOwner && companies && (
          <label className="text-xs font-bold">Company
            <select name="company" defaultValue={f.company} className={inputCls}>
              <option value="">Semua company</option>
              {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </label>
        )}
        <label className="text-xs font-bold">Cari kata
          <input type="search" name="q" defaultValue={f.q} placeholder="mis. retur, stok, ads" className={inputCls} />
        </label>
        <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white">Terapkan</button>
        <a href={`/pantauan/unduh?${qs({})}`} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-bold">Unduh CSV</a>
      </form>

      <p className="mt-3 text-sm text-zinc-700">
        {rangeText} · <b>{items.length}</b> laporan{belumTotal > 0 ? <> · <b className="text-red-700">{belumTotal} kendala belum ditangani</b></> : null}
        {truncated && <span className="text-amber-800"> · hanya 1.000 laporan terbaru yang dimuat, persempit periode atau filter</span>}
      </p>

      {summary.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
              <tr><th className="p-2">Divisi</th><th className="p-2">Laporan berisi kendala</th><th className="p-2">Belum ditangani</th><th className="p-2">Laporan berisi insight</th></tr>
            </thead>
            <tbody>
              {summary.map(([name, g]) => (
                <tr key={name} className="border-t border-zinc-100">
                  <td className="p-2 font-bold">{name}</td>
                  <td className="p-2">{g.kendala}</td>
                  <td className={`p-2 ${g.belum > 0 ? "font-bold text-red-700" : ""}`}>{g.belum}</td>
                  <td className="p-2">{g.insight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Tidak ada yang cocok dengan filter ini.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((it) => (
            <li key={it.id} className={`${cardCls} text-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {it.userName} <span className="font-normal text-zinc-600">· {it.positionName}{isOwner && !f.company ? ` · ${it.companyName}` : ""} · {fmtTanggal(it.date)}</span>
                </p>
                <Link href={`/dashboard/laporan/${it.id}`} className="text-xs font-bold text-accent underline">Buka laporan →</Link>
              </div>
              {it.kendala && (
                <div className="mt-2 rounded-lg border-l-4 border-red-300 bg-red-50 p-2">
                  <p className="text-xs font-bold text-red-800">Kendala</p>
                  <p className="whitespace-pre-wrap">{it.kendala}</p>
                </div>
              )}
              {it.insight && (
                <div className="mt-2 rounded-lg border-l-4 border-sky-300 bg-sky-50 p-2">
                  <p className="text-xs font-bold text-sky-800">Insight</p>
                  <p className="whitespace-pre-wrap">{it.insight}</p>
                </div>
              )}
              {it.handled ? (
                <div className="mt-2 rounded-lg bg-green-50 p-2 text-green-900">
                  <p>✓ <b>Sudah ditangani</b> oleh {it.handled.by} pada {fmtTanggal(it.handled.at.slice(0, 10))}{it.handled.note ? ` — ${it.handled.note}` : ""}</p>
                  {canMark && <UnmarkForm id={it.id} />}
                </div>
              ) : (
                canMark && <MarkForm id={it.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
