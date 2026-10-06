import { saveCompany, setCompanyActive } from "@/app/(app)/owner/actions";
import { ActionButton } from "@/components/owner/ActionButton";
import { ActionForm } from "@/components/owner/ActionForm";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { requireOwnerPage } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";

type Company = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_holding: boolean;
  is_active: boolean;
};

function CompanyFields({ c, companies }: { c?: Company; companies: Company[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <label className={labelCls}>
        Kode *
        <input name="code" defaultValue={c?.code} required placeholder="mis. TERA" className={`${inputCls} uppercase`} />
      </label>
      <label className={labelCls}>
        Nama *
        <input name="name" defaultValue={c?.name} required placeholder="mis. Tera Digilab" className={inputCls} />
      </label>
      <label className={labelCls}>
        Induk (holding)
        <select name="parent_id" defaultValue={c?.parent_id ?? ""} className={inputCls}>
          <option value="">— Tidak ada —</option>
          {companies
            .filter((x) => x.id !== c?.id)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      </label>
      <label className={labelCls}>
        Keterangan
        <input name="description" defaultValue={c?.description ?? ""} className={inputCls} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_holding" defaultChecked={c?.is_holding} /> Ini perusahaan holding (induk)
      </label>
    </div>
  );
}

export default async function OwnerCompanyPage() {
  await requireOwnerPage();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, code, name, description, parent_id, is_holding, is_active")
    .order("is_holding", { ascending: false })
    .order("name");
  if (error) throw new Error(`Gagal memuat company: ${error.message}`);
  const companies = (data ?? []) as Company[];
  const nameOf = (id: string | null) => companies.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Company</h1>

      <section className={cardCls}>
        <h2 className="mb-3 font-bold">Tambah company</h2>
        <ActionForm action={saveCompany} submitLabel="Tambah" resetOnSuccess>
          <CompanyFields companies={companies} />
        </ActionForm>
      </section>

      <section className="space-y-3">
        {companies.map((c) => (
          <div key={c.id} className={`${cardCls} ${c.is_active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">
                  {c.name} <span className="font-normal text-zinc-500">({c.code})</span>
                </p>
                <p className="text-sm text-zinc-600">
                  {c.is_holding ? "Holding" : `Anak usaha${c.parent_id ? ` dari ${nameOf(c.parent_id)}` : ""}`}
                  {!c.is_active && " · NONAKTIF"}
                </p>
              </div>
              <ActionButton
                run={setCompanyActive.bind(null, c.id, !c.is_active)}
                label={c.is_active ? "Nonaktifkan" : "Aktifkan lagi"}
                tone={c.is_active ? "danger" : "default"}
                confirm={
                  c.is_active
                    ? `Nonaktifkan ${c.name}? Company ini tidak bisa dipilih untuk undangan atau notulensi baru. Data lama tetap ada.`
                    : undefined
                }
              />
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-bold text-accent">Ubah</summary>
              <ActionForm action={saveCompany} submitLabel="Simpan perubahan" className="mt-3">
                <CompanyFields c={c} companies={companies} />
              </ActionForm>
            </details>
          </div>
        ))}
      </section>
    </div>
  );
}
