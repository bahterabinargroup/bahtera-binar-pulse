import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Halaman sementara (M0): mengecek apakah aplikasi sudah tersambung ke Supabase
// dan apakah skema database sudah dijalankan. Akan diganti di M1.
export const dynamic = "force-dynamic";

type Check = { label: string; ok: boolean; detail: string };

async function runChecks(): Promise<Check[]> {
  const env = getSupabaseEnv();
  const checks: Check[] = [
    {
      label: "Kunci Supabase di .env.local",
      ok: !!env,
      detail: env
        ? `Terisi (${new URL(env.url).host})`
        : "Belum diisi. Ikuti panduan langkah 3.",
    },
  ];
  if (!env) return checks;

  if (/service_role|^sb_secret_/.test(env.key)) {
    checks.push({
      label: "Jenis kunci",
      ok: false,
      detail:
        "Ini kunci RAHASIA. Ganti dengan publishable/anon key, lalu buat ulang secret key di Supabase.",
    });
    return checks;
  }

  const supabase = await createClient();
  // Tanpa login, RLS mengembalikan 0 baris (bukan error) jika tabel ada.
  const { error } = await supabase.from("roles_config").select("id").limit(1);
  checks.push({
    label: "Koneksi ke Supabase",
    ok: !error || !/fetch|network|Invalid API key/i.test(error.message),
    detail: error ? error.message : "Tersambung",
  });
  checks.push({
    label: "Skema database sudah dijalankan",
    ok: !error,
    detail: error
      ? "Tabel belum ditemukan. Ikuti panduan langkah 2."
      : "Tabel roles_config ditemukan",
  });
  return checks;
}

export default async function Home() {
  const checks = await runChecks();
  const allOk = checks.every((c) => c.ok);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Daily Report — Cek Persiapan</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Halaman sementara untuk memastikan aplikasi tersambung ke database.
      </p>
      <ul className="mt-6 space-y-3">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`rounded-lg border p-4 ${c.ok ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
          >
            <p className="font-semibold">
              {c.ok ? "✅" : "❌"} {c.label}
            </p>
            <p className="mt-1 text-sm text-zinc-700">{c.detail}</p>
          </li>
        ))}
      </ul>
      {allOk && (
        <p className="mt-6 rounded-lg bg-zinc-900 p-4 text-white">
          Semua siap. Persiapan (M0) selesai.
        </p>
      )}
    </main>
  );
}
