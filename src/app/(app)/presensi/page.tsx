import { CheckInForm } from "@/components/presensi/CheckInForm";
import { CheckOutForm } from "@/components/presensi/CheckOutForm";
import { cardCls } from "@/components/owner/ui";
import { formatHariTanggal, formatJam, todayJakarta } from "@/lib/date";
import { fmtRentang, kindLabel } from "@/lib/leave";
import { mapsUrl, PRESENSI_BUCKET, statusLabel } from "@/lib/presensi";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

type Row = {
  status: string;
  note: string | null;
  check_in_at: string;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_photo_path: string | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_photo_path: string | null;
};

// Presensi harian. Data identitas (nama, company, jabatan, tanggal) otomatis; karyawan hanya mengisi status dan bukti.
export default async function PresensiPage() {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (!profile.company) return <p className="text-sm">Akun Anda belum punya company. Hubungi admin.</p>;

  const today = todayJakarta();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("presensi")
    .select("status, note, check_in_at, check_in_lat, check_in_lng, check_in_photo_path, check_out_at, check_out_lat, check_out_lng, check_out_photo_path")
    .eq("user_id", profile.id)
    .eq("attendance_date", today)
    .maybeSingle();
  const tableMissing = error?.code === "42P01" || error?.code === "PGRST205";
  if (error && !tableMissing) throw new Error(`Gagal memuat presensi: ${error.message}`);
  const row = (data as Row | null) ?? null;

  // Cuti/izin yang sudah disetujui dan berlaku hari ini (kecuali hari Minggu): tidak perlu presensi.
  let leave: { kind: string; start_date: string; end_date: string; reason: string } | null = null;
  if (!row && new Date(`${today}T00:00:00Z`).getUTCDay() !== 0) {
    const { data: lv } = await supabase
      .from("leave_requests")
      .select("kind, start_date, end_date, reason")
      .eq("user_id", profile.id)
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today)
      .limit(1)
      .maybeSingle();
    leave = lv ?? null;
  }

  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: signed } = await supabase.storage.from(PRESENSI_BUCKET).createSignedUrl(path, 600);
    return signed?.signedUrl ?? null;
  };
  const [photoUrl, outPhotoUrl] = row ? await Promise.all([sign(row.check_in_photo_path), sign(row.check_out_photo_path)]) : [null, null];
  // Izin dan Sakit tidak perlu pulang (tidak masuk kerja).
  const needCheckOut = !!row && !row.check_out_at && row.status !== "izin" && row.status !== "sakit";

  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Presensi</h1>

      <dl className={`${cardCls} mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm`}>
        <dt className="font-bold">Nama</dt>
        <dd>{profile.full_name}</dd>
        <dt className="font-bold">Company</dt>
        <dd>{profile.company.name}</dd>
        <dt className="font-bold">Departemen</dt>
        <dd>{profile.position?.name ?? "—"}</dd>
        <dt className="font-bold">Hari, tanggal</dt>
        <dd>{formatHariTanggal()}</dd>
      </dl>

      {tableMissing ? (
        <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Fitur presensi belum aktif: tabelnya belum dibuat. Jalankan <code>supabase/008_presensi.sql</code>.
        </p>
      ) : leave ? (
        <div className="mt-4 rounded-xl border border-green-300 bg-green-50 p-4 text-sm">
          <p className="font-bold text-green-800">✓ Hari ini Anda {kindLabel(leave.kind)} (sudah disetujui)</p>
          <p className="mt-1">{fmtRentang(leave.start_date, leave.end_date)}</p>
          <p className="mt-1">Alasan: {leave.reason}</p>
          <p className="mt-2 text-zinc-700">Anda tidak perlu Check-In dan tidak perlu mengisi daily report hari ini. Jika tidak jadi, ajukan pembatalan di menu <b>Cuti / Izin</b>.</p>
        </div>
      ) : row ? (
        <div className="mt-4 rounded-xl border border-green-300 bg-green-50 p-4 text-sm">
          <p className="font-bold text-green-800">✓ Sudah Check-In pukul {formatJam(row.check_in_at)} WIB</p>
          <p className="mt-1">Status: <b>{statusLabel(row.status)}</b></p>
          {row.note && <p className="mt-1">Catatan: {row.note}</p>}
          {row.check_in_lat !== null && row.check_in_lng !== null ? (
            <p className="mt-1">
              <a href={mapsUrl(row.check_in_lat, row.check_in_lng)} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">
                Lihat lokasi di Google Maps
              </a>
            </p>
          ) : (
            <p className="mt-1 text-amber-800">Lokasi tidak tercatat.</p>
          )}
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Foto Check-In" className="mt-2 max-h-48 rounded-lg border border-zinc-200" />
          )}
        </div>
      ) : (
        <CheckInForm companyId={profile.company.id} userId={profile.id} today={today} />
      )}

      {row?.check_out_at && (
        <div className="mt-4 rounded-xl border border-green-300 bg-green-50 p-4 text-sm">
          <p className="font-bold text-green-800">
            ✓ {row.status === "izin" || row.status === "sakit" ? "Check-Out otomatis" : "Sudah Check-Out"} pukul {formatJam(row.check_out_at)} WIB
          </p>
          {row.status !== "izin" && row.status !== "sakit" && row.check_out_lat !== null && row.check_out_lng !== null ? (
            <p className="mt-1">
              <a href={mapsUrl(row.check_out_lat, row.check_out_lng)} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">
                Lihat lokasi pulang di Google Maps
              </a>
            </p>
          ) : row.status !== "izin" && row.status !== "sakit" ? (
            <p className="mt-1 text-amber-800">Lokasi pulang tidak tercatat.</p>
          ) : null}
          {outPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={outPhotoUrl} alt="Foto Check-Out" className="mt-2 max-h-48 rounded-lg border border-zinc-200" />
          )}
        </div>
      )}
      {needCheckOut && <CheckOutForm companyId={profile.company.id} userId={profile.id} today={today} />}
      {row && !row.check_out_at && !needCheckOut && <p className="mt-3 text-xs text-zinc-600">Status {statusLabel(row.status)} tidak perlu Check-Out.</p>}
    </div>
  );
}
