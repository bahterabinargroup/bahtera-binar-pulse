import { cardCls } from "@/components/owner/ui";
import { CreateBotKey, RevokeBotKey } from "@/components/owner/BotKeyControls";
import { requireOwnerPage } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";

type KeyRow = { id: string; name: string; key_prefix: string; active: boolean; created_at: string; revoked_at: string | null; last_used_at: string | null };
type LogRow = { id: number; key_name: string | null; endpoint: string; filters: Record<string, unknown>; row_count: number | null; created_at: string };

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

// API Bot (Owner): kunci untuk bot analisis (baca-saja) dan log pemakaiannya.
export default async function ApiBotPage() {
  await requireOwnerPage();
  const supabase = await createClient();
  const [keysRes, logRes] = await Promise.all([
    supabase.from("api_keys").select("id, name, key_prefix, active, created_at, revoked_at, last_used_at").order("created_at", { ascending: false }),
    supabase.from("api_audit_log").select("id, key_name, endpoint, filters, row_count, created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  if (keysRes.error?.code === "42P01" || keysRes.error?.code === "PGRST205") {
    return (
      <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Fitur belum aktif: jalankan <code>supabase/025_api_bot.sql</code>.
      </p>
    );
  }
  if (keysRes.error) throw new Error(`Gagal memuat kunci: ${keysRes.error.message}`);
  if (logRes.error) throw new Error(`Gagal memuat log: ${logRes.error.message}`);
  const keys = (keysRes.data ?? []) as KeyRow[];
  const logs = (logRes.data ?? []) as LogRow[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">API Bot</h1>
      <p className="text-sm text-zinc-600">
        Kunci untuk bot analisis (mis. Rakazo) agar bisa MEMBACA laporan dan notulensi semua company lewat alamat <code>/api/bot/v1</code>. Bot tidak
        bisa mengubah apa pun. Siapa pun yang memegang kunci bisa membaca data, jadi simpan kunci hanya di pengaturan bot dan cabut bila bocor.
      </p>

      <section className={cardCls} aria-labelledby="kunci-baru">
        <h2 id="kunci-baru" className="mb-2 font-bold">
          Buat kunci baru
        </h2>
        <CreateBotKey />
      </section>

      <section className={cardCls} aria-labelledby="daftar-kunci">
        <h2 id="daftar-kunci" className="mb-2 font-bold">
          Daftar kunci
        </h2>
        {keys.length === 0 ? (
          <p className="text-sm text-zinc-600">Belum ada kunci.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-bold">
                    {k.name}{" "}
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${k.active ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"}`}>
                      {k.active ? "Aktif" : "Dicabut"}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-600">
                    <code>{k.key_prefix}…</code> · dibuat {fmt(k.created_at)} · terakhir dipakai {fmt(k.last_used_at)}
                    {k.revoked_at ? ` · dicabut ${fmt(k.revoked_at)}` : ""}
                  </p>
                </div>
                {k.active && <RevokeBotKey id={k.id} name={k.name} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardCls} aria-labelledby="log">
        <h2 id="log" className="mb-2 font-bold">
          Log pemakaian (200 terakhir)
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-zinc-600">Belum ada pemakaian.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-accent text-left text-white">
                  {["Waktu", "Kunci", "Endpoint", "Filter", "Baris"].map((h) => (
                    <th key={h} className="border border-black px-2 py-1.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="border border-black px-2 py-1.5 whitespace-nowrap">{fmt(l.created_at)}</td>
                    <td className="border border-black px-2 py-1.5">{l.key_name ?? "—"}</td>
                    <td className="border border-black px-2 py-1.5">/{l.endpoint}</td>
                    <td className="border border-black px-2 py-1.5 text-xs">
                      {Object.entries(l.filters ?? {})
                        .filter(([k]) => k !== "cursor")
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(", ") || "—"}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-right">{l.row_count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
