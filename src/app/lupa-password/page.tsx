import { AuthCard } from "@/components/AuthCard";
import { ForgotForm } from "./ForgotForm";

export default function LupaPasswordPage() {
  return (
    <AuthCard
      title="Lupa password"
      subtitle="Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat password baru."
    >
      <ForgotForm />
    </AuthCard>
  );
}
