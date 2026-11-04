import { csvBody } from "@/lib/csv";
import { todayJakarta } from "@/lib/date";
import { fmtDurasi, fmtJamWib, fmtMenitJam, loadRingkasan, statusHari } from "@/lib/presensi-ringkasan";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { parseMonth } from "@/lib/target";

// Unduh ringkasan presensi per karyawan untuk satu bulan (Owner, Manager, Lead; data disaring RLS).
export async function GET(request: Request) {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role === "employee") return new Response("Hanya Owner, Manager, dan Lead.", { status: 403 });
  const url = new URL(request.url);
  const month = parseMonth(url.searchParams.get("bulan"), `${todayJakarta().slice(0, 7)}-01`);
  const supabase = await createClient();
  const { list, tableMissing } = await loadRingkasan(supabase, profile, month, url.searchParams.get("company") ?? "");
  if (tableMissing) return new Response("Fitur presensi belum aktif.", { status: 500 });

  const compRes = profile.role === "owner" ? await supabase.from("companies").select("id, name") : { data: null };
  const comps = new Map(((compRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  if (url.searchParams.get("rinci")) {
    // Satu baris per karyawan per tanggal, lalu satu baris "Rata-rata" per karyawan.
    const out: unknown[][] = [];
    for (const r of list) {
      const nama = [r.person.full_name, comps.get(r.person.company_id) ?? "", r.person.position?.name ?? ""];
      for (const h of r.harian) {
        out.push([...nama, h.date, statusHari(h.status), fmtJamWib(h.masuk) === "—" ? "" : fmtJamWib(h.masuk), h.pulang ? fmtJamWib(h.pulang) + (h.otomatis ? " (otomatis)" : "") : "", h.menit ?? "", h.menit !== null ? fmtDurasi(h.menit) : ""]);
      }
      out.push([...nama, "RATA-RATA", "", fmtMenitJam(r.avgMasukMenit) === "—" ? "" : fmtMenitJam(r.avgMasukMenit), fmtMenitJam(r.avgPulangMenit) === "—" ? "" : fmtMenitJam(r.avgPulangMenit), r.kantorHari ? Math.round(r.kantorMenit / r.kantorHari) : "", r.kantorHari ? fmtDurasi(Math.round(r.kantorMenit / r.kantorHari)) : ""]);
    }
    return new Response(csvBody(["Nama", "Company", "Jabatan", "Tanggal", "Status", "Jam masuk (WIB)", "Jam pulang (WIB)", "Lama di kantor (menit)", "Lama di kantor"], out), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="presensi-per-tanggal-${month.slice(0, 7)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const body = csvBody(
    ["Nama", "Company", "Jabatan", "WFO (hari)", "Tugas Luar (hari)", "Izin (hari)", "Sakit (hari)", "Cuti (hari)", "Tanpa keterangan (hari)", "Tidak Check-Out (hari)", "Tanggal tanpa keterangan", "Tanggal tidak Check-Out", "Rata-rata jam masuk (WIB)", "Rata-rata jam pulang (WIB)", "Total di kantor", "Total di kantor (menit)", "Rata-rata di kantor per hari WFO"],
    list.map((r) => [
      r.person.full_name,
      comps.get(r.person.company_id) ?? "",
      r.person.position?.name ?? "",
      r.wfo,
      r.tugasLuar,
      r.izin,
      r.sakit,
      r.cuti,
      r.tanpaKet.length,
      r.belumPulang,
      r.tanpaKet.join(" "),
      r.lupaOut.join(" "),
      fmtMenitJam(r.avgMasukMenit),
      fmtMenitJam(r.avgPulangMenit),
      fmtDurasi(r.kantorMenit),
      r.kantorMenit,
      r.kantorHari ? fmtDurasi(Math.round(r.kantorMenit / r.kantorHari)) : "",
    ]),
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ringkasan-presensi-${month.slice(0, 7)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
