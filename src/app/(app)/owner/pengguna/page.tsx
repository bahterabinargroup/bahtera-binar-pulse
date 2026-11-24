import Link from "next/link";
import { UserRow, type UserRowData } from "@/components/owner/UserRow";
import { cardCls } from "@/components/owner/ui";
import { requireOwnerPage } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerPenggunaPage({ searchParams }: PageProps<"/owner/pengguna">) {
  const owner = await requireOwnerPage();
  const company = typeof (await searchParams).company === "string" ? ((await searchParams).company as string) : "";
  const supabase = await createClient();

  let q = supabase
    .from("users")
    .select("id, full_name, email, employee_code, role, position_id, lead_position_ids, work_start_date, is_active, company_id, company:companies(name)")
    .order("is_active", { ascending: false })
    .order("full_name");
  if (company) q = q.eq("company_id", company);
  const [users, comp, pos] = await Promise.all([
    q,
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("roles_config").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  for (const r of [users, comp, pos]) if (r.error) throw new Error(`Gagal memuat data: ${r.error.message}`);

  const rows: UserRowData[] = (users.data ?? []).map((u) => ({
    ...u,
    company_name: (u.company as unknown as { name: string } | null)?.name ?? "—",
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pengguna</h1>
      <p className="text-sm text-zinc-600">
        Role menentukan hak akses (urutan: Owner, Manager, Lead, Karyawan); jabatan menentukan form laporan. Lead bisa memantau divisi tambahan (mis. Lead ADV memantau ADV MH): atur lewat kotak &quot;Divisi yang dipantau&quot;. Pengguna baru ditambahkan lewat{" "}
        <Link href="/owner/undangan" className="font-bold text-accent underline">
          Undangan Karyawan
        </Link>
        .
      </p>
      <nav className="flex flex-wrap gap-2 text-sm">
        {[{ id: "", name: "Semua company" }, ...comp.data!].map((c) => (
          <Link
            key={c.id}
            href={c.id ? `/owner/pengguna?company=${c.id}` : "/owner/pengguna"}
            className={`rounded-full border px-3 py-1 font-bold ${company === c.id ? "border-accent bg-accent text-white" : "border-zinc-300 bg-white"}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <section className={cardCls}>
        <p className="text-sm text-zinc-600">{rows.length} pengguna</p>
        <ul className="divide-y divide-zinc-100">
          {rows.map((u) => (
            <UserRow key={u.id} user={u} positions={pos.data!} isSelf={u.id === owner.id} />
          ))}
        </ul>
      </section>
    </div>
  );
}
