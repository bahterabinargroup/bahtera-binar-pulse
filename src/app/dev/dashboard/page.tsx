import { notFound } from "next/navigation";
import { DashboardView, type DashboardData } from "@/components/dashboard/DashboardView";
import { targetProgress } from "@/lib/target";
import { aggregateAdv, complianceByDay, complianceByPosition, complianceTotal, eachDay, isWorkday, periodRange, presenceRate, type AdvRow, type ReportLite, type UserLite } from "@/lib/dashboard";

// HANYA pengembangan lokal: dashboard dengan data rekaan (angka bukan data asli).
export default async function DevDashboardPage({ searchParams }: PageProps<"/dev/dashboard">) {
  if (process.env.NODE_ENV !== "development") notFound();
  const sp = await searchParams;
  const saya = sp.mode === "saya";
  const range = periodRange("30", "2026-10-09");
  const days = eachDay(range.from, range.to);

  const mkUser = (id: string, position: number): UserLite => ({ id, role: "employee", is_active: true, created_at: "2026-08-01T00:00:00Z", position_id: position });
  const users = [mkUser("a1", 2), mkUser("a2", 2), mkUser("a3", 2), mkUser("c1", 4), mkUser("c2", 4), mkUser("m1", 5), mkUser("r1", 6)];
  const reports: ReportLite[] = [];
  const advRows: AdvRow[] = [];
  const state = { seed: 7 };
  const rnd = () => ((state.seed = (state.seed * 9301 + 49297) % 233280) / 233280);
  for (const day of days) {
    if (!isWorkday(day)) continue;
    for (const u of users) {
      if (rnd() < 0.12) continue;
      reports.push({ user_id: u.id, report_date: day, position_id: u.position_id, presensi: rnd() < 0.85 ? "Sudah" : "Belum" });
      if (u.position_id === 2) {
        const g1 = Math.round((600 + rnd() * 900) * 1000), g2 = Math.round((200 + rnd() * 500) * 1000);
        advRows.push({
          user_id: u.id, report_date: day, toko: "Toko " + u.id,
          data_toko: [
            { nama: u.id === "a1" ? "Toko Maju" : u.id === "a2" ? "Toko Sehat" : "Toko Baru", impresi_harian: 20000, jumlah_pesanan: Math.round(g1 / 90000), gmv: g1, ads_spent: Math.round(g1 * (0.3 + rnd() * 0.25)) },
            { nama: u.id === "a1" ? "Toko Maju 2" : "", impresi_harian: 9000, jumlah_pesanan: Math.round(g2 / 90000), gmv: g2, ads_spent: Math.round(g2 * 0.4) },
          ],
          tarik: rnd() < 0.8 ? "Sudah" : "Belum", tracker: rnd() < 0.7 ? "Sudah" : "Belum", brief: rnd() < 0.6 ? "Sudah" : "Belum", presensi: "Sudah",
        });
      }
    }
  }
  const dayRows = complianceByDay(users, reports, days);
  const mine = new Set(reports.filter((r) => r.user_id === "a1").map((r) => r.report_date));
  const adv = aggregateAdv(saya ? advRows.filter((r) => r.user_id === "a1") : advRows, days);
  const data: DashboardData = {
    scope: saya ? "saya" : "tim",
    periode: "30",
    range,
    companyName: "Semua company",
    compliance: { days: saya ? complianceByDay(users.filter((u) => u.id === "a1"), reports, days) : dayRows, total: complianceTotal(saya ? complianceByDay(users.filter((u) => u.id === "a1"), reports, days) : dayRows) },
    today: { filled: 5, expected: 7 },
    byPosition: complianceByPosition(users, reports, days, { 2: "Advertiser", 4: "Content Creator", 5: "Affiliate Manajemen", 6: "Research & Development" }),
    presence: presenceRate(reports),
    adv,
    target: (() => {
      const daily: Record<string, number> = {};
      for (const r of advRows) { if (r.report_date >= "2026-10-01" && r.report_date <= "2026-10-09") daily[r.report_date] = (daily[r.report_date] ?? 0) + (r.data_toko as { gmv: number }[]).reduce((s, e) => s + e.gmv, 0); }
      return { monthLabel: "Oktober 2026", progress: targetProgress(180000000, daily, "2026-10-09"), advCount: 3, perAdv: saya ? [] : [{ name: "Alvian", actual: 21500000, target: 60000000, pct: 35.8 }, { name: "Alam", actual: 18200000, target: 50000000, pct: 36.4 }, { name: "Tian", actual: 9100000, target: 70000000, pct: 13 }].sort((a, b) => b.pct - a.pct) };
    })(),
    kendala: 14,
    overdue: 2,
    myDays: saya ? days.map((day) => ({ day, label: String(Number(day.slice(8))), state: !isWorkday(day) ? "off" : mine.has(day) ? "ok" : "miss" })) : undefined,
  };
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <DashboardView d={data} />
    </main>
  );
}
