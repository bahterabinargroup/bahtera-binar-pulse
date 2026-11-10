import Image from "next/image";
import { signOut } from "@/app/auth-actions";
import { AppShell } from "@/components/nav/AppShell";
import { navFor } from "@/lib/menu";
import { getNavBadges } from "@/lib/nav-badges";
import { getCurrentUser, ROLE_LABEL } from "@/lib/profile";

// Bingkai semua halaman setelah login: kepala halaman berisi identitas
// pengguna dan tombol Keluar. Akun tanpa profil hanya melihat pesan.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, profile } = await getCurrentUser();

  const logoutButton = (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-bold hover:bg-zinc-100"
      >
        Keluar
      </button>
    </form>
  );

  if (!profile) {
    return (
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <Image src="/brand/logo-utama.png" alt="Bahtera Binar Group" width={1144} height={746} className="mx-auto h-24 w-auto" />
          <p className="mt-2 text-4xl">🔒</p>
          <h1 className="mt-2 text-xl font-bold">Akun Anda belum terdaftar. Hubungi admin.</h1>
          {user?.email && (
            <p className="mt-2 text-sm text-zinc-600">Anda masuk sebagai {user.email}.</p>
          )}
          <div className="mt-6 flex justify-center">{logoutButton}</div>
        </div>
      </main>
    );
  }

  // Sidebar: folder dan menu sesuai role (aturan akses yang sudah ada); penanda angka dari database
  const groups = navFor(profile.role, profile.position?.code);
  const badges = await getNavBadges(profile);

  return (
    <AppShell
      groups={groups}
      badges={badges}
      name={profile.full_name}
      subtitle={[profile.position?.name, profile.company?.name].filter(Boolean).join(" · ")}
      roleLabel={ROLE_LABEL[profile.role]}
      logoutButton={logoutButton}
    >
      {children}
    </AppShell>
  );
}
