import { AuthCard } from "@/components/AuthCard";
import { getCurrentUser } from "@/lib/profile";
import { SetPasswordForm } from "./SetPasswordForm";

// Dibuka dari tautan undangan atau lupa password (sudah login lewat tautan),
// atau oleh pengguna yang ingin mengganti password.
export default async function AturPasswordPage() {
  const { user } = await getCurrentUser();

  return (
    <AuthCard
      title="Atur password"
      subtitle={user?.email ? `Untuk akun ${user.email}.` : undefined}
    >
      <SetPasswordForm />
    </AuthCard>
  );
}
