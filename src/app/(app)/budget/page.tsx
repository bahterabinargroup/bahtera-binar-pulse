import { redirect } from "next/navigation";
import { BudgetCalculator } from "@/components/budget/BudgetCalculator";
import { canUseBudget } from "@/lib/menu";
import { getCurrentUser } from "@/lib/profile";

// Kalkulator pengajuan budget iklan. Jabatan ADV, ADV_MH, SPV, serta Owner.
export default async function BudgetPage() {
  const { profile } = await getCurrentUser();
  if (!profile || !canUseBudget(profile.role, profile.position?.code)) redirect("/");
  return (
    <div>
      <h1 className="text-2xl font-bold text-accent">Kalkulator Budget</h1>
      <BudgetCalculator defaultAdv={profile.full_name} />
    </div>
  );
}
