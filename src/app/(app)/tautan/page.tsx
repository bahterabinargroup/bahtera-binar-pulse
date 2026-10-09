import { redirect } from "next/navigation";
import { ActionButton } from "@/components/owner/ActionButton";
import { ActionForm } from "@/components/owner/ActionForm";
import { LinkGroups } from "@/components/links/LinkGroups";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { categoryLabel, hostOf, LINK_CATEGORIES, LINK_SELECT, positionNameMap, type ResourceLink } from "@/lib/links";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { deleteLink, saveLink } from "./actions";

type Option = { id: string | number; name: string };

function LinkFields({
  link,
  companies,
  positions,
  isOwner,
  ownCompany,
}: {
  link?: ResourceLink;
  companies: Option[];
  positions: Option[];
  isOwner: boolean;
  ownCompany: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {link && <input type="hidden" name="id" value={link.id} />}
      <label className={`${labelCls} sm:col-span-2`}>
        Judul *
        <input name="title" defaultValue={link?.title} required maxLength={120} placeholder="mis. Tracker penjualan harian" className={inputCls} />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>
        Alamat link (URL) *
        <input
          name="url"
          defaultValue={link?.url}
          required
          inputMode="url"
          placeholder="https://docs.google.com/spreadsheets/..."
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Kategori *
        <select name="category" defaultValue={link?.category ?? "tracker"} className={inputCls}>
          {LINK_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        Keterangan singkat
        <input name="description" defaultValue={link?.description ?? ""} maxLength={300} placeholder="mis. Isi sebelum jam 10 pagi" className={inputCls} />
      </label>
      <fieldset className={`${labelCls} sm:col-span-2`}>
        <legend>Untuk divisi (boleh pilih lebih dari satu)</legend>
        <div className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-3">
          {positions.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" name="position_ids" value={p.id} defaultChecked={link?.position_ids.includes(Number(p.id))} />
              {p.name}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs font-normal text-zinc-500">Jangan centang apa pun = untuk <b>semua divisi</b>.</p>
      </fieldset>
      {isOwner ? (
        <label className={labelCls}>
          Untuk company
          <select name="company_id" defaultValue={link?.company_id ?? ""} className={inputCls}>
            <option value="">Semua company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className={labelCls}>
          Untuk company
          <span className="mt-1 block rounded-lg bg-zinc-100 px-2 py-1.5 text-sm font-normal">{ownCompany}</span>
        </p>
      )}
    </div>
  );
}

export default async function KelolaTautanPage() {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role === "employee") redirect("/");
  const isOwner = profile.role === "owner";

  const supabase = await createClient();
  const [linksRes, compRes, posRes] = await Promise.all([
    supabase.from("resource_links").select(LINK_SELECT).order("category").order("title"),
    supabase.from("companies").select("id, name").eq("is_active", true).order("name"),
    supabase.from("roles_config").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  const tableMissing = linksRes.error?.code === "42P01" || linksRes.error?.code === "PGRST205";
  if (!tableMissing && linksRes.error) throw new Error(`Gagal memuat tautan: ${linksRes.error.message}`);
  if (compRes.error) throw new Error(compRes.error.message);
  if (posRes.error) throw new Error(posRes.error.message);

  if (tableMissing) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Fitur tautan belum aktif: tabelnya belum dibuat di database. Jalankan <code>supabase/005_tautan_penting.sql</code> di Supabase SQL Editor.
      </p>
    );
  }

  const links = (linksRes.data ?? []) as unknown as ResourceLink[];
  const companies = (compRes.data ?? []) as Option[];
  const positions = (posRes.data ?? []) as Option[];
  const ownCompany = profile.company?.name ?? "";
  const positionNames = positionNameMap(posRes.data as { id: number; name: string }[]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-accent">Kelola Tautan Penting</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Kumpulkan link kerja (tracker spreadsheet, aset, SOP) di satu tempat. Tautan tampil di Beranda sesuai company dan divisi
          karyawan. Akses ke isi file (Drive, Spreadsheet, dll.) tetap diatur di layanan masing-masing; aplikasi ini hanya
          menyimpan jalan pintasnya.
        </p>
      </div>

      <section className={cardCls}>
        <h2 className="mb-3 font-bold">Tambah tautan</h2>
        <ActionForm action={saveLink} submitLabel="Tambah tautan" resetOnSuccess>
          <LinkFields companies={companies} positions={positions} isOwner={isOwner} ownCompany={ownCompany} />
        </ActionForm>
      </section>

      <section className={cardCls}>
        <h2 className="mb-3 font-bold">Semua tautan ({links.length})</h2>
        {links.length === 0 && <p className="text-sm text-zinc-500">Belum ada tautan.</p>}
        <ul className="divide-y divide-zinc-100">
          {links.map((l) => (
            <li key={l.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline decoration-gold underline-offset-2">
                    {l.title}
                  </a>
                  <p className="text-xs text-zinc-500">
                    {categoryLabel(l.category)} · {hostOf(l.url)}
                  </p>
                  {l.description && <p className="text-sm text-zinc-600">{l.description}</p>}
                  <p className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">{l.company?.name ?? "Semua company"}</span>
                    {l.position_ids.length === 0 ? (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">Semua divisi</span>
                    ) : (
                      l.position_ids.map((id) => (
                        <span key={id} className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                          {positionNames[id] ?? "Divisi"}
                        </span>
                      ))
                    )}
                  </p>
                </div>
                <ActionButton
                  run={deleteLink.bind(null, l.id)}
                  label="Hapus"
                  tone="danger"
                  confirm={`Hapus tautan "${l.title}"? Link-nya hilang dari Beranda semua orang.`}
                />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-bold text-accent">Ubah</summary>
                <ActionForm action={saveLink} submitLabel="Simpan perubahan" className="mt-3">
                  <LinkFields link={l} companies={companies} positions={positions} isOwner={isOwner} ownCompany={ownCompany} />
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {links.length > 0 && (
        <section className={cardCls}>
          <h2 className="mb-3 font-bold">Tampilan di Beranda (contoh)</h2>
          <LinkGroups links={links} showScope positionNames={positionNames} />
        </section>
      )}
    </div>
  );
}
