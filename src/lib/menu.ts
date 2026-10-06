import type { UserRole } from "./profile";

export type MenuItem = {
  label: string;
  description: string;
  href: string;
  roles: UserRole[];
  ready: boolean; // false = halaman belum dibangun (milestone berikutnya)
};

const ALL: UserRole[] = ["owner", "manager", "employee"];

// Satu-satunya daftar menu. Tampil sesuai role (BRIEF bagian 5).
export const MENU: MenuItem[] = [
  { label: "Laporan Hari Ini", description: "Isi laporan harian Anda", href: "/laporan", roles: ALL, ready: false },
  { label: "Riwayat Laporan", description: "Laporan yang sudah Anda kirim", href: "/riwayat", roles: ALL, ready: false },
  { label: "Notulensi", description: "Catatan meeting dan tindak lanjut", href: "/notulensi", roles: ALL, ready: false },
  { label: "Dashboard Tim", description: "Siapa yang belum mengisi dan rekap kepatuhan", href: "/dashboard", roles: ["owner", "manager"], ready: false },
  { label: "Company", description: "Kelola holding dan anak usaha", href: "/owner/company", roles: ["owner"], ready: false },
  { label: "Undangan Karyawan", description: "Daftarkan karyawan baru", href: "/owner/undangan", roles: ["owner"], ready: false },
  { label: "Pengguna", description: "Aktifkan, nonaktifkan, ubah role dan jabatan", href: "/owner/pengguna", roles: ["owner"], ready: false },
  { label: "Tarikan Mingguan", description: "Tabel dan unduh laporan satu minggu", href: "/owner/tarikan", roles: ["owner"], ready: false },
];

export function menuFor(role: UserRole) {
  return MENU.filter((m) => m.roles.includes(role));
}
