import Link from "next/link";
import { ActionForm } from "@/components/owner/ActionForm";
import { cardCls, inputCls } from "@/components/owner/ui";
import { todayJakarta } from "@/lib/date";
import { fmtRp, fmtRpFull } from "@/lib/format";
import { requireOwnerPage } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { monthLabel, monthStart, nextMonth, parseMonth, prevMonth, workdaysInMonth } from "@/lib/target";
import { copyLastMonth, saveTargets } from "./actions";

const dot = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

export default async function AturTargetPage({ searchParams }: PageProps<"/target">) {
  await requireOwnerPage();
  const sp = await searchParams;
  const month = parseMonth(sp.bulan, monthStart(todayJakarta()));
  const supabase = await createClient();

  const [posRes, compRes] = await Promise.all([
    supabase.from("roles_config").select("id").eq("code", "ADV").maybeSingle(),
    supabase.from("companies").select("id, name").order("name"),
  ]);
  if (posRes.error) throw new Error(posRes.error.message);
  if (compRes.error) throw new Error(compRes.error.message);
  const advId = posRes.data?.id as number | undefined;

  const usersRes = advId
    ? await supabase.from("users").select("id, full_name, company_id").eq("is_active", true).eq("position_id", advId).order("full_name")
    : { data: [], error: null };
  if (usersRes.error) throw new Error(usersRes.error.message);
  const advs = (usersRes.data ?? []) as { id: string; full_name: string; company_id: string }[];

  const [curRes, lastRes] = await Promise.all([
    supabase.from("omzet_targets").select("user_id, amount").eq("month", month),
    supabase.from("omzet_targets").select("user_id, amount").eq("month", prevMonth(month)),
  ]);
  const tableMissing = curRes.error?.code === "42P01" || curRes.error?.code === "PGRST205";
  if (tableMissing) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Fitur target belum aktif: tabelnya belum dibuat. Jalankan <code>supabase/007_target_omzet.sql</code> di Supabase SQL Editor.
      </p>
    );
  }
  if (curRes.error) throw new Error(curRes.error.message);
  if (lastRes.error) throw new Error(lastRes.error.message);

  const cur = new Map((curRes.data ?? []).map((r) => [r.user_id as string, Number(r.amount)]));
  const last = new Map((lastRes.data ?? []).map((r) => [r.user_id as string, Number(r.amount)]));
  const work = workdaysInMonth(month).length;
  const companies = (compRes.data ?? []).filter((c) => advs.some((a) => a.company_id === c.id));
  const total = [...cur.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-accent">Atur Target Omzet</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Tetapkan target omzet bulanan tiap ADV. Dashboard membandingkannya dengan GMV dari laporan harian ADV. Target harian = target bulan ÷ jumlah
          hari kerja (Senin–Sabtu).
        </p>
      </div>

      <nav className="flex flex-wrap items-center gap-2 text-sm font-bold">
        <Link href={`/target?bulan=${prevMonth(month).slice(0, 7)}`} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5">
          ← {monthLabel(prevMonth(month))}
        </Link>
        <span className="rounded-lg bg-accent px-4 py-1.5 text-white">{monthLabel(month)}</span>
        <Link href={`/target?bulan=${nextMonth(month).slice(0, 7)}`} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5">
          {monthLabel(nextMonth(month))} →
        </Link>
      </nav>

      <section className={cardCls}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <b>{work}</b> hari kerja bulan ini · total target tersimpan <b title={fmtRpFull(total)}>{fmtRp(total)}</b>
            {total > 0 && <> · target harian total <b>{fmtRp(total / work)}</b></>}
          </p>
          <ActionForm action={copyLastMonth} submitLabel="Salin target bulan lalu">
            <input type="hidden" name="month" value={month} />
          </ActionForm>
        </div>

        {advs.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum ada pengguna berjabatan Advertiser (ADV) yang aktif.</p>
        ) : (
          <ActionForm action={saveTargets} submitLabel="Simpan target">
            <input type="hidden" name="month" value={month} />
            <div className="space-y-5">
              {companies.map((c) => {
                const members = advs.filter((a) => a.company_id === c.id);
                const sub = members.reduce((s, a) => s + (cur.get(a.id) ?? 0), 0);
                return (
                  <fieldset key={c.id}>
                    <legend className="mb-2 flex w-full flex-wrap items-baseline justify-between gap-2 font-bold">
                      <span>{c.name}</span>
                      <span className="text-sm font-normal text-zinc-600">Total company: {fmtRp(sub)}</span>
                    </legend>
                    <ul className="space-y-2">
                      {members.map((a) => (
                        <li key={a.id} className="grid items-center gap-2 sm:grid-cols-[1fr_220px]">
                          <label htmlFor={`amt_${a.id}`} className="font-bold">
                            {a.full_name}
                            {cur.get(a.id) ? <span className="ml-2 text-xs font-normal text-zinc-500">harian {fmtRp(cur.get(a.id)! / work)}</span> : null}
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-zinc-500">Rp</span>
                            <input
                              id={`amt_${a.id}`}
                              name={`amt_${a.id}`}
                              defaultValue={cur.has(a.id) ? dot(cur.get(a.id)!) : ""}
                              placeholder={last.has(a.id) ? `bulan lalu ${dot(last.get(a.id)!)}` : "mis. 50.000.000"}
                              inputMode="numeric"
                              className={inputCls}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-zinc-500">Kosongkan kolom untuk menghapus target ADV itu pada bulan ini. Tulis angka saja, contoh 50.000.000.</p>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
