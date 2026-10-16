import Link from "next/link";

// Tab di atas halaman Notulensi, Tugas saya, dan (Owner/Manager) Daftar tindak lanjut.
export function MeetingTabs({ active, showFollowup = false }: { active: "notulensi" | "tugas" | "tindak"; showFollowup?: boolean }) {
  const cls = (on: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-bold ${on ? "bg-accent text-white" : "border border-zinc-300 bg-white text-zinc-700"}`;
  return (
    <nav className="mb-4 flex flex-wrap gap-2">
      <Link href="/notulensi" className={cls(active === "notulensi")}>
        Notulensi
      </Link>
      <Link href="/tugas" className={cls(active === "tugas")}>
        Tugas saya
      </Link>
      {showFollowup && (
        <Link href="/tindak-lanjut" className={cls(active === "tindak")}>
          Tindak lanjut
        </Link>
      )}
    </nav>
  );
}
