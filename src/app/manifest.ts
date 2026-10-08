import type { MetadataRoute } from "next";

// Agar aplikasi bisa dipasang di layar utama ponsel ("Tambahkan ke layar utama").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bahtera Binar Pulse",
    short_name: "Pulse",
    description: "Laporan harian, notulensi, dan tugas tim Bahtera Binar Group",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#012c4e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
