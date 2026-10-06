import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { BackToHome } from "@/components/BackToHome";
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
          <p className="text-4xl">🔒</p>
          <h1 className="mt-2 text-xl font-bold">Akun Anda belum terdaftar. Hubungi admin.</h1>
          {user?.email && (
            <p className="mt-2 text-sm text-zinc-600">Anda masuk sebagai {user.email}.</p>
          )}
          <div className="mt-6 flex justify-center">{logoutButton}</div>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3 px-4 py-3">
          <Link href="/" className="min-w-0">
            <p className="text-xs font-bold tracking-widest text-accent">DAILY REPORT</p>
            <p className="truncate font-bold">{profile.full_name}</p>
            <p className="truncate text-sm text-zinc-600">
              {[profile.position?.name, profile.company?.name].filter(Boolean).join(" · ")}
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-bold text-zinc-700">
                {ROLE_LABEL[profile.role]}
              </span>
            </p>
          </Link>
          {logoutButton}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <BackToHome />
        {children}
      </main>
    </>
  );
}
