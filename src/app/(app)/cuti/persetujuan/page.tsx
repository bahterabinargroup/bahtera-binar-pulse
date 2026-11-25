import Link from "next/link";
import { redirect } from "next/navigation";
import { DecideForm } from "@/components/cuti/LeaveForms";
import { cardCls } from "@/components/owner/ui";
import { todayJakarta } from "@/lib/date";
import { cancelPending, fmtRentang, isExpired, kindLabel, LEAVE_COLUMNS, shownStatus, STATUS_LABEL, workdaysBetween, type LeaveRow } from "@/lib/leave";
import { getCurrentUser, isManagerial } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

type Person = { id: string; full_name: string; role: string; position: { name: string } | null };

// Persetujuan cuti/izin untuk Owner (semua) dan Manager (karyawan di company-nya). Data disaring RLS; keputusan dijaga database.
export default async function PersetujuanCutiPage() {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (!isManagerial(profile.role)) redirect("/cuti");
  const isOwner = profile.role === "owner";
  const today = todayJakarta();

  const supabase = await createClient();
  const [openRes, histRes] = await Promise.all([
    supabase
      .from("leave_requests")
      .select(LEAVE_COLUMNS)
      .or("status.eq.pending,and(status.eq.approved,cancel_requested_at.not.is.null,cancel_outcome.is.null)")
      .order("start_date")
      .limit(200),
    supabase
      .from("leave_requests")
      .select(LEAVE_COLUMNS)
      .in("status", ["approved", "rejected", "cancelled"])
      .gte("end_date", addMonths(today, -1))
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);
  const tableMissing = openRes.error?.code === "42P01" || openRes.error?.code === "PGRST205";
  if (tableMissing) {
    return <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Fitur cuti/izin belum aktif. Jalankan supabase/011 dan 012.</p>;
  }
  for (const r of [openRes, histRes]) if (r.error) throw new Error(`Gagal memuat pengajuan: ${r.error.message}`);
  const open = (openRes.data ?? []) as unknown as LeaveRow[];
  // Menunggu tetapi tanggalnya sudah lewat = kedaluwarsa: pindah ke riwayat (tidak bisa diputuskan lagi).
  const expired = open.filter((r) => isExpired(r, today));
  const hist = [...expired, ...((histRes.data ?? []) as unknown as LeaveRow[]).filter((r) => !open.some((o) => o.id === r.id))];

  const ids = [...new Set([...open, ...hist].map((r) => r.user_id))];
  const { data: ppl } = ids.length
    ? await supabase.from("users").select("id, full_name, role, position:roles_config(name)").in("id", ids)
    : { data: [] };
  const people = new Map(((ppl ?? []) as unknown as Person[]).map((p) => [p.id, p]));

  // Siapa yang boleh diputuskan oleh yang login (database tetap menjaga).
  const canDecide = (r: LeaveRow) => r.user_id !== profile.id && (isOwner || ["employee", "lead"].includes(people.get(r.user_id)?.role ?? ""));
  const label = (r: LeaveRow) => {
    const p = people.get(r.user_id);
    return `${p?.full_name ?? "—"}${p?.position ? ` · ${p.position.name}` : ""}`;
  };

  const Item = ({ r, mode }: { r: LeaveRow; mode: "leave" | "cancel" }) => (
    <li className={`${cardCls} text-sm`}>
      <p className="font-bold">{label(r)}</p>
      <p className="mt-1">
        {kindLabel(r.kind)} · {fmtRentang(r.start_date, r.end_date)} <span className="text-zinc-600">({workdaysBetween(r.start_date, r.end_date)} hari kerja)</span>
      </p>
      <p className="mt-1">Alasan: {r.reason}</p>
      {mode === "cancel" && <p className="mt-1 rounded bg-amber-50 p-2 text-amber-900">Minta dibatalkan: {r.cancel_reason}</p>}
      {canDecide(r) ? <DecideForm id={r.id} mode={mode} /> : <p className="mt-2 text-xs text-zinc-600">{r.user_id === profile.id ? "Pengajuan Anda sendiri." : "Menunggu keputusan Owner."}</p>}
    </li>
  );

  const pendings = open.filter((r) => r.status === "pending" && !isExpired(r, today));
  const cancels = open.filter(cancelPending);

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Persetujuan Cuti / Izin</h1>
      <p className="mt-1 text-sm text-zinc-600">{isOwner ? "Semua company." : "Karyawan dan Lead di company Anda. Pengajuan sesama Manager diputuskan Owner."} <Link href="/cuti/kalender" className="font-bold text-accent underline">Lihat kalender cuti →</Link></p>

      <h2 className="mt-5 text-lg font-bold">Pengajuan menunggu keputusan ({pendings.length})</h2>
      {pendings.length === 0 ? (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Tidak ada pengajuan yang menunggu.</p>
      ) : (
        <ul className="mt-2 space-y-3">{pendings.map((r) => <Item key={r.id} r={r} mode="leave" />)}</ul>
      )}

      <h2 className="mt-6 text-lg font-bold">Pengajuan pembatalan menunggu keputusan ({cancels.length})</h2>
      {cancels.length === 0 ? (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Tidak ada pembatalan yang menunggu.</p>
      ) : (
        <ul className="mt-2 space-y-3">{cancels.map((r) => <Item key={r.id} r={r} mode="cancel" />)}</ul>
      )}

      <h2 className="mt-6 text-lg font-bold">Riwayat terbaru</h2>
      {hist.length === 0 ? (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
              <tr><th className="p-2">Nama</th><th className="p-2">Jenis</th><th className="p-2">Tanggal</th><th className="p-2">Status</th><th className="p-2">Catatan</th></tr>
            </thead>
            <tbody>
              {hist.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 align-top">
                  <td className="p-2 font-bold">{label(r)}</td>
                  <td className="p-2">{kindLabel(r.kind)}</td>
                  <td className="p-2">{fmtRentang(r.start_date, r.end_date)}</td>
                  <td className="p-2">{STATUS_LABEL[shownStatus(r, today)]}{r.cancel_outcome === "approved" && r.status === "approved" ? " (dipotong)" : ""}</td>
                  <td className="p-2">{r.decision_note ?? r.cancel_note ?? <span className="text-zinc-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function addMonths(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
