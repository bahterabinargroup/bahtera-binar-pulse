import Image from "next/image";

// Bingkai sederhana untuk halaman login, lupa password, dan atur password.
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 border-t-4 border-t-gold bg-white p-6 shadow-sm">
        <Image
          src="/brand/logo-utama.png"
          alt="Bahtera Binar Group"
          width={1144}
          height={746}
          priority
          className="mx-auto h-28 w-auto"
        />
        <p className="mt-1 text-center text-xs font-bold tracking-[0.25em] text-gold">BAHTERA BINAR PULSE</p>
        <div className="mx-auto my-4 h-px w-16 bg-gold" />
        <h1 className="text-2xl font-bold text-accent">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function FormMessage({ type, children }: { type: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={type === "error" ? "alert" : "status"}
      className={`rounded-lg border p-3 text-sm ${
        type === "error"
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-green-300 bg-green-50 text-green-800"
      }`}
    >
      {children}
    </p>
  );
}

export const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export const buttonClass =
  "w-full rounded-lg bg-accent px-4 py-2.5 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
