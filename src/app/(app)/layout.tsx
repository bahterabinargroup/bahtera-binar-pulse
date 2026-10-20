import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { BackToHome } from "@/components/BackToHome";
import { DesktopNav, MobileNav } from "@/components/nav/AppNav";
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
  const groups = navFor(profile.role);
  const badges = await getNavBadges(profile);

  return (
    <>
      <header className="border-b-4 border-gold bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <MobileNav groups={groups} badges={badges} />
              <Link href="/" aria-label="Beranda">
                <Image
                  src="/brand/logo-horizontal.png"
                  alt="Bahtera Binar Group"
                  width={941}
                  height={360}
                  priority
                  className="h-12 w-auto"
                />
              </Link>
            </div>
            {logoutButton}
          </div>
          <Link href="/" className="mt-1 block min-w-0">
            <p className="truncate font-bold text-accent">{profile.full_name}</p>
            <p className="truncate text-sm text-zinc-600">
              {[profile.position?.name, profile.company?.name].filter(Boolean).join(" · ")}
              <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-white">
                {ROLE_LABEL[profile.role]}
              </span>
            </p>
          </Link>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <DesktopNav groups={groups} badges={badges} />
        <main className="min-w-0 max-w-5xl flex-1">
          {/* Di layar lebar, tombol Beranda sudah ada di sidebar */}
          <div className="md:hidden">
            <BackToHome />
          </div>
          {children}
        </main>
      </div>
    </>
  );
}
