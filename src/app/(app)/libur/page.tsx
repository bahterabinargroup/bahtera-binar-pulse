import { redirect } from "next/navigation";
import { ActionButton } from "@/components/owner/ActionButton";
import { ActionForm } from "@/components/owner/ActionForm";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { formatHariTanggal, dateFromYmd, todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { addHoliday, deleteHoliday } from "./actions";

type Holiday = { holiday_date: string; name: string };

// Daftar hari libur (tanggal merah / libur kantor) untuk semua company. Hanya Owner.
export default async function HariLiburPage({ searchParams }: PageProps<"/libur">) {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role !== "owner") redirect("/");

  const sp = await searchParams;
  const today = todayJakarta();
  const tahun = /^\d{4}$/.test(String(sp.tahun ?? "")) ? String(sp.tahun) : today.slice(0, 4);

  const supabase = await createClient();
  const { data, error } = await supabase.from("holidays").select("holiday_date, name").gte("holiday_date", `${tahun}-01-01`).lte("holiday_date", `${tahun}-12-31`).order("holiday_date");
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return (
      <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Fitur hari libur belum aktif: jalankan <code>supabase/019_hari_libur.sql</code> di Supabase SQL Editor.
      </p>
    );
  }
  if (error) throw new Error(`Gagal memuat hari libur: ${error.message}`);
  const list = (data ?? []) as Holiday[];
  const years = [Number(today.slice(0, 4)) - 1, Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1].map(String);
  if (!years.includes(tahun)) years.push(tahun);

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Hari Libur</h1>
      <p className="mt-1 text-sm text-zinc-600">Tanggal merah dan libur kantor, berlaku untuk semua company. Tanggal di sini tidak dihitung &quot;tanpa keterangan&quot; di Ringkasan Presensi.</p>

      <section className={`${cardCls} mt-4`}>
        <h2 className="font-bold">Tambah hari libur</h2>
        <ActionForm action={addHoliday} submitLabel="Tambah" resetOnSuccess className="mt-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={labelCls}>
              Tanggal *
              <input type="date" name="holiday_date" required className={inputCls} />
            </label>
            <label className={`${labelCls} sm:col-span-2`}>
              Nama hari libur *
              <input name="name" required maxLength={100} placeholder="mis. Hari Raya Idul Fitri" className={inputCls} />
            </label>
          </div>
        </ActionForm>
      </section>

      <form action="/libur" className="mt-6 flex items-center gap-2">
        <h2 className="text-lg font-bold">Daftar tahun</h2>
        <select name="tahun" defaultValue={tahun} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm" aria-label="Tahun">
          {years.sort().map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white">Tampilkan</button>
      </form>

      {list.length === 0 ? (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada hari libur di tahun {tahun}.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm shadow-sm">
          {list.map((h) => (
            <li key={h.holiday_date} className="flex flex-wrap items-center justify-between gap-2 p-2">
              <span>
                <b>{formatHariTanggal(dateFromYmd(h.holiday_date))}</b>
                <span className="text-zinc-600"> · {h.name}</span>
              </span>
              <ActionButton run={deleteHoliday.bind(null, h.holiday_date)} label="Hapus" tone="danger" confirm={`Hapus hari libur "${h.name}"?`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
