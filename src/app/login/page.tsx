import { AuthCard } from "@/components/AuthCard";
import { LoginForm } from "./LoginForm";

const ERRORS: Record<string, string> = {
  tautan:
    "Tautan sudah kedaluwarsa atau sudah pernah dipakai. Minta tautan baru lewat \"Lupa password?\", atau hubungi admin untuk undangan ulang.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const errorKey = typeof params.error === "string" ? params.error : undefined;

  return (
    <AuthCard title="Masuk" subtitle="Gunakan email dan password akun Anda.">
      <LoginForm next={next} initialError={errorKey ? ERRORS[errorKey] : undefined} />
    </AuthCard>
  );
}
