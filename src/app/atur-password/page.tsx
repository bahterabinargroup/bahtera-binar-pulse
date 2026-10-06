import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { getCurrentUser } from "@/lib/profile";
import { SetPasswordForm } from "./SetPasswordForm";

// Dibuka dari tautan undangan atau lupa password (sudah login lewat tautan),
// atau oleh pengguna yang ingin mengganti password.
export default async function AturPasswordPage({ searchParams }: PageProps<"/atur-password">) {
  const { user } = await getCurrentUser();
  const isInvite = (await searchParams).jenis === "undangan";

  return (
    <AuthCard
      title={isInvite ? "Buat password" : "Atur password"}
      subtitle={
        isInvite
          ? `Selamat datang! Buat password untuk akun ${user?.email ?? "Anda"}. Password ini dipakai setiap kali masuk.`
          : user?.email
            ? `Untuk akun ${user.email}.`
            : undefined
      }
    >
      <SetPasswordForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/" className="font-bold text-accent hover:underline">
          ← Kembali ke Beranda
        </Link>
      </p>
    </AuthCard>
  );
}
