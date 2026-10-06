// Menerjemahkan pesan error Supabase Auth ke bahasa Indonesia yang ramah.
export function translateAuthError(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Email atau password salah.";
  if (m.includes("email not confirmed"))
    return "Email belum dikonfirmasi. Buka tautan undangan di email Anda terlebih dahulu.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
  if (m.includes("should be different"))
    return "Password baru harus berbeda dari password lama.";
  if (m.includes("password") && (m.includes("weak") || m.includes("at least") || m.includes("characters")))
    return "Password terlalu lemah. Gunakan minimal 8 karakter, campuran huruf dan angka.";
  if (m.includes("session") || m.includes("jwt") || m.includes("not authenticated"))
    return "Sesi Anda sudah berakhir. Silakan buka ulang tautan dari email atau masuk lagi.";
  if (m.includes("fetch") || m.includes("network"))
    return "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
  return "Terjadi kesalahan. Silakan coba lagi.";
}

// Hanya izinkan pengalihan ke halaman di dalam aplikasi ini.
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
