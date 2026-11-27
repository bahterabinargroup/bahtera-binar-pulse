import Link from "next/link";
import { MeetingTabs } from "@/components/meetings/MeetingTabs";
import { dateFromYmd, formatHariTanggal } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const PER_PAGE = 30;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

type Item = {
  id: string;
  title: string;
  meeting_date: string;
  location: string | null;
  submitted_at: string | null;
  delete_requested_at: string | null;
  created_by_name: string | null;
  company: { name: string } | null;
  meeting_action_items: { status: string }[];
};

// Daftar notulensi. RLS: Owner semua, Manager company-nya, pembuat miliknya, peserta (karyawan) setelah Submit.
export default async function NotulensiPage({ searchParams }: PageProps<"/notulensi">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  const isOwner = profile.role === "owner";

  const sp = await searchParams;
  const q = one(sp.q).trim();
  const dari = one(sp.dari);
  const sampai = one(sp.sampai);
  const status = one(sp.status);
  const company = one(sp.company);
  const page = Math.max(1, Number(one(sp.halaman)) || 1);
  const from = (page - 1) * PER_PAGE;

  const supabase = await createClient();
  let query = supabase
    .from("meetings")
    .select(
      "id, title, meeting_date, location, submitted_at, delete_requested_at, created_by_name, company:companies(name), meeting_action_items(status)",
      { count: "exact" },
    )
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (q) query = query.ilike("title", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dari)) query = query.gte("meeting_date", dari);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sampai)) query = query.lte("meeting_date", sampai);
  if (status === "draft") query = query.is("submitted_at", null);
  if (status === "submit") query = query.not("submitted_at", "is", null);
  if (status === "hapus") query = query.not("delete_requested_at", "is", null);
  if (isOwner && company) query = query.eq("company_id", company);

  const [{ data, error, count }, companies] = await Promise.all([
    query,
    isOwner ? supabase.from("companies").select("id, name").order("name") : Promise.resolve({ data: null }),
  ]);
  if (error) throw new Error(`Gagal memuat notulensi: ${error.message}`);
  const items = (data ?? []) as unknown as Item[];
  const total = count ?? 0;
  const pesan = one(sp.pesan);

  const pageLink = (p: number) => {
    const params = new URLSearchParams({ q, dari, sampai, status, company, halaman: String(p) });
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    return `/notulensi?${params}`;
  };
  const inputCls = "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div>
      <MeetingTabs active="notulensi" showFollowup={profile.role === "owner" || profile.role === "manager"} showTarikan={profile.role === "owner"} />
      {pesan === "terhapus" && (
        <p role="status" className="mb-3 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Notulensi sudah dihapus.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notulensi Meeting</h1>
        <Link href="/notulensi/baru" className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110">
          + Buat Notulensi
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-white p-3">
        <label className="text-xs font-bold">
          Cari judul
          <input name="q" defaultValue={q} placeholder="nama meeting…" className={`${inputCls} mt-1 block w-44`} />
        </label>
        <label className="text-xs font-bold">
          Dari
          <input type="date" name="dari" defaultValue={dari} className={`${inputCls} mt-1 block`} />
        </label>
        <label className="text-xs font-bold">
          Sampai
          <input type="date" name="sampai" defaultValue={sampai} className={`${inputCls} mt-1 block`} />
        </label>
        <label className="text-xs font-bold">
          Status
          <select name="status" defaultValue={status} className={`${inputCls} mt-1 block`}>
            <option value="">Semua</option>
            <option value="draft">Draft</option>
            <option value="submit">Sudah submit</option>
            <option value="hapus">Permintaan hapus</option>
          </select>
        </label>
        {companies.data && (
          <label className="text-xs font-bold">
            Company
            <select name="company" defaultValue={company} className={`${inputCls} mt-1 block`}>
              <option value="">Semua company</option>
              {companies.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm font-bold text-white">
          Terapkan
        </button>
        {(q || dari || sampai || status || company) && (
          <Link href="/notulensi" className="py-1.5 text-sm text-accent underline">
            Reset
          </Link>
        )}
      </form>

      <p className="mt-4 text-sm text-zinc-600">{total} notulensi</p>
      {items.length === 0 && (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada notulensi yang cocok.</p>
      )}
      <ul className="mt-2 space-y-2">
        {items.map((m) => {
          const open = m.meeting_action_items.filter((a) => a.status !== "done").length;
          return (
            <li key={m.id}>
              <Link
                href={`/notulensi/${m.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-accent"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold">{m.title}</p>
                  <div className="flex flex-wrap gap-1">
                    {m.delete_requested_at && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Menunggu persetujuan hapus</span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        m.submitted_at ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {m.submitted_at ? "Sudah submit" : "Draft"}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {formatHariTanggal(dateFromYmd(m.meeting_date))}
                  {m.location ? ` · ${m.location}` : ""} · ditulis {m.created_by_name ?? "—"}
                  {isOwner && m.company ? ` · ${m.company.name}` : ""}
                </p>
                <p className={`mt-1 text-xs font-bold ${open ? "text-amber-700" : "text-zinc-400"}`}>
                  {open ? `${open} tindak lanjut belum selesai` : "Tidak ada tindak lanjut terbuka"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      {(page > 1 || from + items.length < total) && (
        <nav className="mt-6 flex justify-between text-sm font-bold">
          {page > 1 ? <Link href={pageLink(page - 1)} className="text-accent">← Lebih baru</Link> : <span />}
          {from + items.length < total && <Link href={pageLink(page + 1)} className="text-accent">Lebih lama →</Link>}
        </nav>
      )}
    </div>
  );
}
