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
  { label: "Laporan Hari Ini", description: "Isi laporan harian Anda", href: "/laporan", roles: ALL, ready: true },
  { label: "Presensi", description: "Check-In pagi dan Check-Out pulang", href: "/presensi", roles: ALL, ready: true },
  { label: "Cuti / Izin", description: "Ajukan cuti atau izin (juga jauh hari) dan lihat statusnya", href: "/cuti", roles: ["employee", "manager"], ready: true },
  { label: "Persetujuan Cuti/Izin", description: "Setujui atau tolak pengajuan cuti, izin, dan pembatalannya", href: "/cuti/persetujuan", roles: ["owner", "manager"], ready: true },
  { label: "Rekap Presensi", description: "Siapa sudah Check-In/Check-Out hari ini, lengkap dengan lokasi dan foto", href: "/presensi/rekap", roles: ["owner", "manager"], ready: true },
  { label: "Pratinjau Form", description: "Lihat form setiap jabatan (tanpa menyimpan)", href: "/laporan/pratinjau", roles: ["owner"], ready: true },
  { label: "Riwayat Laporan", description: "Laporan yang sudah Anda kirim", href: "/riwayat", roles: ALL, ready: true },
  { label: "Notulensi", description: "Catatan meeting dan tindak lanjut", href: "/notulensi", roles: ALL, ready: true },
  { label: "Tugas Saya", description: "Tindak lanjut meeting yang ditugaskan ke Anda", href: "/tugas", roles: ALL, ready: true },
  { label: "Panduan", description: "Cara memakai aplikasi, langkah demi langkah", href: "/panduan", roles: ALL, ready: true },
  { label: "Kelola Tautan", description: "Kumpulkan link tracker, aset, dan SOP untuk tim", href: "/tautan", roles: ["owner", "manager"], ready: true },
  { label: "Dashboard Tim", description: "Siapa yang belum mengisi dan rekap kepatuhan", href: "/dashboard", roles: ["owner", "manager"], ready: true },
  { label: "Atur Target", description: "Tetapkan target omzet bulanan tiap ADV", href: "/target", roles: ["owner"], ready: true },
  { label: "Company", description: "Kelola holding dan anak usaha", href: "/owner/company", roles: ["owner"], ready: true },
  { label: "Undangan Karyawan", description: "Daftarkan karyawan baru", href: "/owner/undangan", roles: ["owner"], ready: true },
  { label: "Pengguna", description: "Aktifkan, nonaktifkan, ubah role dan jabatan", href: "/owner/pengguna", roles: ["owner"], ready: true },
  { label: "Tarikan Mingguan", description: "Tabel dan unduh laporan satu minggu", href: "/owner/tarikan", roles: ["owner"], ready: true },
];

export function menuFor(role: UserRole) {
  return MENU.filter((m) => m.roles.includes(role));
}
