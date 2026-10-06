import Link from "next/link";

// Tab di atas halaman Notulensi dan Tugas saya.
export function MeetingTabs({ active }: { active: "notulensi" | "tugas" }) {
  const cls = (on: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-bold ${on ? "bg-accent text-white" : "border border-zinc-300 bg-white text-zinc-700"}`;
  return (
    <nav className="mb-4 flex gap-2">
      <Link href="/notulensi" className={cls(active === "notulensi")}>
        Notulensi
      </Link>
      <Link href="/tugas" className={cls(active === "tugas")}>
        Tugas saya
      </Link>
    </nav>
  );
}
