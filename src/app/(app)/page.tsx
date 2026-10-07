import Link from "next/link";
import { formatHariTanggal } from "@/lib/date";
import { menuFor } from "@/lib/menu";
import { getCurrentUser } from "@/lib/profile";

export default async function BerandaPage({ searchParams }: PageProps<"/">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null; // ditangani layout
  const params = await searchParams;
  const items = menuFor(profile.role);

  return (
    <div>
      {params.pesan === "password-tersimpan" && (
        <p role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Password berhasil disimpan.
        </p>
      )}
      <p className="text-sm text-zinc-600">{formatHariTanggal()}</p>
      <h1 className="text-2xl font-bold text-accent">Halo, {profile.full_name.split(" ")[0]}</h1>
      {!profile.position && profile.role !== "owner" && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Jabatan Anda belum diatur, sehingga form laporan belum bisa ditampilkan. Hubungi admin.
        </p>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const body = (
            <>
              <p className="flex items-center justify-between gap-2 font-bold">
                {item.label}
                {!item.ready && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-500">
                    Segera hadir
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
            </>
          );
          return (
            <li key={item.href}>
              {item.ready ? (
                <Link
                  href={item.href}
                  className="block h-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-gold hover:shadow-md"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-xl border border-dashed border-zinc-300 bg-white/60 p-4 text-zinc-500">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center text-sm">
        <Link href="/atur-password" className="text-accent hover:underline">
          Ganti password
        </Link>
      </p>
    </div>
  );
}
