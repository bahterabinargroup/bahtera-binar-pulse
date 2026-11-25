import { CancelPendingForm, CancelRequestForm, LeaveRequestForm } from "@/components/cuti/LeaveForms";
import { cardCls } from "@/components/owner/ui";
import { todayJakarta } from "@/lib/date";
import { cancelPending, fmtRentang, fmtTanggal, isExpired, kindLabel, LEAVE_COLUMNS, quotaUsage, shownStatus, STATUS_LABEL, workdaysBetween, type LeaveRow } from "@/lib/leave";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-zinc-200 text-zinc-700",
  expired: "bg-zinc-200 text-zinc-700",
};

// Pengajuan cuti/izin milik sendiri: ajukan baru, lihat status, batalkan, atau ajukan pembatalan.
export default async function CutiPage() {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  const today = todayJakarta();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(LEAVE_COLUMNS)
    .eq("user_id", profile.id)
    .order("start_date", { ascending: false })
    .limit(100);
  const tableMissing = error?.code === "42P01" || error?.code === "PGRST205";
  if (error && !tableMissing) throw new Error(`Gagal memuat pengajuan: ${error.message}`);
  const rows = (data ?? []) as unknown as LeaveRow[];
  // Tanggal mulai kerja menentukan awal periode kuota (kosong = bulan kalender). Kolom baru dari 023; bila belum ada, anggap kosong.
  const { data: me } = await supabase.from("users").select("work_start_date").eq("id", profile.id).maybeSingle();
  const anchor = ((me as { work_start_date?: string | null } | null)?.work_start_date ?? null) as string | null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Cuti / Izin</h1>
      <p className="mt-1 text-sm text-zinc-600">Ajukan cuti atau izin, bahkan jauh-jauh hari (maksimal 2 pengajuan per periode; periode dihitung dari tanggal mulai kerja Anda). Atasan akan menyetujui atau menolak. Bila disetujui, pada harinya presensi dan daily report tidak diperlukan.</p>

      {tableMissing ? (
        <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Fitur cuti/izin belum aktif. Jalankan <code>supabase/011_cuti_izin.sql</code> dan <code>012</code>.
        </p>
      ) : profile.role === "owner" ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm">Owner tidak mengajukan cuti. Untuk memutuskan pengajuan tim, buka <b>Persetujuan Cuti/Izin</b>.</p>
      ) : (
        <LeaveRequestForm today={today} usage={quotaUsage(rows, anchor, today)} anchor={anchor} />
      )}

      <h2 className="mt-6 text-lg font-bold">Pengajuan saya</h2>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">Belum ada pengajuan.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {rows.map((r) => {
            const hari = workdaysBetween(r.start_date, r.end_date);
            const pending = cancelPending(r);
            const canRequestCancel = r.status === "approved" && r.end_date >= today && !pending;
            return (
              <li key={r.id} className={`${cardCls} text-sm`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {kindLabel(r.kind)} · {fmtRentang(r.start_date, r.end_date)} <span className="font-normal text-zinc-600">({hari} hari kerja)</span>
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[shownStatus(r, today)]}`}>{STATUS_LABEL[shownStatus(r, today)]}</span>
                </div>
                <p className="mt-1">Alasan: {r.reason}</p>
                {r.decision_note && <p className="mt-1 text-zinc-700">Catatan atasan: {r.decision_note}</p>}
                {pending && <p className="mt-2 rounded bg-amber-50 p-2 text-amber-900">Pengajuan pembatalan terkirim ({r.cancel_reason}). Menunggu keputusan. Cuti/izin tetap berlaku sementara.</p>}
                {r.cancel_outcome === "rejected" && (
                  <p className="mt-2 rounded bg-red-50 p-2 text-red-800">Pembatalan ditolak{r.cancel_note ? `: ${r.cancel_note}` : "."} Cuti/izin tetap berlaku.</p>
                )}
                {r.cancel_outcome === "approved" && (
                  <p className="mt-2 rounded bg-green-50 p-2 text-green-800">
                    Pembatalan disetujui{r.cancel_decided_at ? ` pada ${fmtTanggal(r.cancel_decided_at.slice(0, 10))}` : ""}
                    {r.status === "approved" ? `. Cuti/izin dipotong sampai ${fmtTanggal(r.end_date)}.` : "."}
                  </p>
                )}
                <div className="mt-2">
                  {r.status === "pending" && !isExpired(r, today) && <CancelPendingForm id={r.id} />}
                  {isExpired(r, today) && <p className="rounded bg-zinc-100 p-2 text-zinc-700">Pengajuan ini tidak diputuskan sampai tanggalnya lewat, sehingga kedaluwarsa dan tidak menghabiskan kuota. Ajukan ulang bila perlu.</p>}
                  {canRequestCancel && <CancelRequestForm id={r.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
