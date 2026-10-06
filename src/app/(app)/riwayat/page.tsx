import Link from "next/link";
import { dateFromYmd, formatHariTanggal, formatJam, todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const PER_PAGE = 30;

type Item = {
  id: string;
  report_date: string;
  updated_at: string;
  position: { name: string } | null;
};

// Daftar laporan milik sendiri, terbaru dulu.
export default async function RiwayatPage({ searchParams }: PageProps<"/riwayat">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;

  const params = await searchParams;
  const page = Math.max(1, Number(params.halaman) || 1);
  const from = (page - 1) * PER_PAGE;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("daily_reports")
    .select("id, report_date, updated_at, position:roles_config(name)", { count: "exact" })
    .eq("user_id", profile.id)
    .order("report_date", { ascending: false })
    .range(from, from + PER_PAGE - 1);
  if (error) throw new Error(`Gagal memuat riwayat: ${error.message}`);

  const items = (data ?? []) as unknown as Item[];
  const today = todayJakarta();
  const total = count ?? 0;
  const hasNext = from + items.length < total;

  return (
    <div>
      <h1 className="text-2xl font-bold">Riwayat Laporan</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {total > 0 ? `${total} laporan, terbaru di atas.` : "Belum ada laporan."}
      </p>

      {total === 0 && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          Anda belum pernah menyimpan laporan.{" "}
          <Link href="/laporan" className="font-bold text-accent underline">
            Isi laporan hari ini
          </Link>
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {items.map((r) => {
          const isToday = r.report_date === today;
          return (
            <li key={r.id}>
              <Link
                href={`/riwayat/${r.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="font-bold">{formatHariTanggal(dateFromYmd(r.report_date))}</p>
                  <p className="truncate text-sm text-zinc-600">
                    {r.position?.name ?? "Tanpa jabatan"} · diperbarui {formatJam(r.updated_at)} WIB
                  </p>
                </div>
                {isToday ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                    Hari ini · bisa diedit
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600">
                    🔒 Terkunci
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {(page > 1 || hasNext) && (
        <nav className="mt-6 flex justify-between text-sm font-bold">
          {page > 1 ? (
            <Link href={`/riwayat?halaman=${page - 1}`} className="text-accent hover:underline">
              ← Lebih baru
            </Link>
          ) : (
            <span />
          )}
          {hasNext && (
            <Link href={`/riwayat?halaman=${page + 1}`} className="text-accent hover:underline">
              Lebih lama →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
