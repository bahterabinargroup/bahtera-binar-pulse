import { cancelInvite, createInvite, resendInvite } from "@/app/(app)/owner/actions";
import { ActionButton } from "@/components/owner/ActionButton";
import { ActionForm } from "@/components/owner/ActionForm";
import { InviteLinkButton } from "@/components/owner/InviteLinkButton";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { formatHariTanggal } from "@/lib/date";
import { requireOwnerPage } from "@/lib/owner";
import { ROLE_LABEL, type UserRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

type Invite = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  employee_code: string | null;
  claimed_at: string | null;
  created_at: string;
  company: { name: string } | null;
  position: { name: string } | null;
};

export default async function OwnerUndanganPage() {
  await requireOwnerPage();
  const supabase = await createClient();
  const [inv, comp, pos] = await Promise.all([
    supabase
      .from("user_invites")
      .select("id, email, full_name, role, employee_code, claimed_at, created_at, company:companies(name), position:roles_config(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("companies").select("id, name").eq("is_active", true).order("name"),
    supabase.from("roles_config").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  for (const r of [inv, comp, pos]) if (r.error) throw new Error(`Gagal memuat data: ${r.error.message}`);
  const invites = (inv.data ?? []) as unknown as Invite[];
  const emailReady = !!process.env.SUPABASE_SECRET_KEY;
  const pending = invites.filter((i) => !i.claimed_at);
  const claimed = invites.filter((i) => i.claimed_at);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Undangan Karyawan</h1>
      {!emailReady && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Email undangan belum aktif.</b> Kunci rahasia (SUPABASE_SECRET_KEY) belum diisi di .env.local. Undangan tetap
          tercatat, tetapi emailnya belum terkirim.
        </p>
      )}

      <section className={cardCls}>
        <h2 className="mb-1 font-bold">Undang karyawan baru</h2>
        <p className="mb-3 text-sm text-zinc-600">
          Karyawan menerima email berisi link. Saat diklik, ia langsung diminta membuat password, lalu akunnya aktif sesuai
          data di bawah.
        </p>
        <ActionForm action={createInvite} submitLabel="Kirim undangan" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Email *
              <input name="email" type="email" required className={inputCls} />
            </label>
            <label className={labelCls}>
              Nama lengkap *
              <input name="full_name" required className={inputCls} />
            </label>
            <label className={labelCls}>
              Company *
              <select name="company_id" required className={inputCls}>
                {comp.data!.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Role (hak akses) *
              <select name="role" defaultValue="employee" className={inputCls}>
                <option value="employee">Karyawan — mengisi laporan sendiri</option>
                <option value="manager">Manager — + melihat laporan & dashboard company-nya</option>
                <option value="owner">Owner — akses penuh semua company</option>
              </select>
            </label>
            <label className={labelCls}>
              Jabatan (menentukan form) *
              <select name="position_id" defaultValue="" className={inputCls}>
                <option value="">— Pilih jabatan —</option>
                {pos.data!.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Kode karyawan
              <input name="employee_code" className={inputCls} />
            </label>
          </div>
        </ActionForm>
      </section>

      <section className={cardCls}>
        <h2 className="mb-1 font-bold">Undangan menunggu ({pending.length})</h2>
        <p className="mb-2 text-sm text-zinc-600">
          Belum diklaim. Jika email tidak terkirim (batas kirim Supabase per jam), klik <b>Salin link undangan</b> lalu
          kirim lewat WhatsApp.
        </p>
        {pending.length === 0 && <p className="text-sm text-zinc-500">Tidak ada undangan yang menunggu.</p>}
        <ul className="divide-y divide-zinc-100">
          {pending.map((i) => (
            <li key={i.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">
                    {i.full_name} <span className="font-normal text-zinc-600">· {i.email}</span>
                  </p>
                  <p className="text-sm text-zinc-600">
                    {i.company?.name} · {ROLE_LABEL[i.role]}
                    {i.position ? ` · ${i.position.name}` : ""}
                    {i.employee_code ? ` · ${i.employee_code}` : ""} · dibuat {formatHariTanggal(new Date(i.created_at))}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Terbuka</span>
              </div>
              <div className="mt-2 flex flex-wrap items-start gap-2">
                <InviteLinkButton inviteId={i.id} name={i.full_name} />
                <ActionButton run={resendInvite.bind(null, i.id)} label="Kirim ulang email" />
                <ActionButton
                  run={cancelInvite.bind(null, i.id)}
                  label="Batalkan"
                  tone="danger"
                  confirm={`Batalkan undangan untuk ${i.email}? Link-nya tidak akan memberi akses.`}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={cardCls}>
        <h2 className="mb-3 font-bold">Sudah diklaim ({claimed.length})</h2>
        {claimed.length === 0 && <p className="text-sm text-zinc-500">Belum ada.</p>}
        <ul className="divide-y divide-zinc-100">
          {claimed.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-bold">
                  {i.full_name} <span className="font-normal text-zinc-600">· {i.email}</span>
                </p>
                <p className="text-sm text-zinc-600">
                  {i.company?.name} · {ROLE_LABEL[i.role]}
                  {i.position ? ` · ${i.position.name}` : ""}
                  {i.employee_code ? ` · ${i.employee_code}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                Diklaim {i.claimed_at ? formatHariTanggal(new Date(i.claimed_at)) : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
