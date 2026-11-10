import type { UserRole } from "./profile";

export type MenuItem = {
  label: string;
  description: string;
  href: string;
  roles: UserRole[];
  // Bila diisi: hanya jabatan ini (kode, mis. "ADV") yang melihat menu, ditambah Owner. Kosong = semua yang punya role-nya.
  positions?: string[];
  ready: boolean; // false = halaman belum dibangun (milestone berikutnya)
};

// Kalkulator Budget Iklan: jabatan ADV dan SPV, serta Owner.
export const BUDGET_POSITIONS = ["ADV", "SPV"];
export const canUseBudget = (role: UserRole, positionCode?: string | null) =>
  role === "owner" || (!!positionCode && BUDGET_POSITIONS.includes(positionCode));

const ALL: UserRole[] = ["owner", "manager", "lead", "employee"];

// Satu-satunya daftar menu. Tampil sesuai role (BRIEF bagian 5).
export const MENU: MenuItem[] = [
  { label: "Laporan Hari Ini", description: "Isi laporan harian Anda", href: "/laporan", roles: ALL, ready: true },
  { label: "Presensi", description: "Check-In pagi dan Check-Out pulang", href: "/presensi", roles: ALL, ready: true },
  { label: "Cuti / Izin", description: "Ajukan cuti atau izin (juga jauh hari) dan lihat statusnya", href: "/cuti", roles: ["employee", "lead", "manager"], ready: true },
  { label: "Persetujuan Cuti/Izin", description: "Setujui atau tolak pengajuan cuti, izin, dan pembatalannya", href: "/cuti/persetujuan", roles: ["owner", "manager"], ready: true },
  { label: "Pantauan Kendala", description: "Semua kendala dan insight dari laporan harian, dengan tanda sudah ditangani", href: "/pantauan", roles: ["owner", "manager", "lead"], ready: true },
  { label: "Daftar Tindak Lanjut", description: "Semua tugas dari notulensi: PIC, tenggat, dan yang lewat tenggat", href: "/tindak-lanjut", roles: ["owner", "manager"], ready: true },
  { label: "Kalender Cuti", description: "Siapa yang cuti atau izin, per tanggal dalam sebulan", href: "/cuti/kalender", roles: ["owner", "manager", "lead"], ready: true },
  { label: "Rekap Presensi", description: "Siapa sudah Check-In/Check-Out hari ini, lengkap dengan lokasi dan foto", href: "/presensi/rekap", roles: ["owner", "manager", "lead"], ready: true },
  { label: "Ringkasan Presensi", description: "Per karyawan sebulan: jam masuk/pulang, lama di kantor, jumlah WFO, tugas luar, izin, sakit, cuti", href: "/presensi/ringkasan", roles: ["owner", "manager", "lead"], ready: true },
  { label: "Hari Libur", description: "Daftar tanggal merah / libur kantor (tidak dihitung tanpa keterangan)", href: "/libur", roles: ["owner"], ready: true },
  { label: "Pratinjau Form", description: "Lihat form setiap jabatan (tanpa menyimpan)", href: "/laporan/pratinjau", roles: ["owner"], ready: true },
  { label: "Riwayat Laporan", description: "Laporan yang sudah Anda kirim", href: "/riwayat", roles: ALL, ready: true },
  { label: "Notulensi", description: "Catatan meeting dan tindak lanjut", href: "/notulensi", roles: ALL, ready: true },
  { label: "Tugas Saya", description: "Tindak lanjut meeting yang ditugaskan ke Anda", href: "/tugas", roles: ALL, ready: true },
  { label: "Panduan", description: "Cara memakai aplikasi, langkah demi langkah", href: "/panduan", roles: ALL, ready: true },
  { label: "Kelola Tautan", description: "Kumpulkan link tracker, aset, dan SOP untuk tim", href: "/tautan", roles: ["owner", "manager"], ready: true },
  { label: "Dashboard Tim", description: "Siapa yang belum mengisi dan rekap kepatuhan", href: "/dashboard", roles: ["owner", "manager", "lead"], ready: true },
  { label: "Kalkulator Budget", description: "Hitung pengajuan budget iklan mingguan dan salin ringkasannya ke WhatsApp", href: "/budget", roles: ALL, positions: BUDGET_POSITIONS, ready: true },
  { label: "Atur Target", description: "Tetapkan target omzet bulanan tiap ADV", href: "/target", roles: ["owner"], ready: true },
  { label: "Company", description: "Kelola holding dan anak usaha", href: "/owner/company", roles: ["owner"], ready: true },
  { label: "Undangan Karyawan", description: "Daftarkan karyawan baru", href: "/owner/undangan", roles: ["owner"], ready: true },
  { label: "Pengguna", description: "Aktifkan, nonaktifkan, ubah role dan jabatan", href: "/owner/pengguna", roles: ["owner"], ready: true },
  { label: "Tarikan Mingguan", description: "Tabel dan unduh laporan satu minggu", href: "/owner/tarikan", roles: ["owner"], ready: true },
];

export function menuFor(role: UserRole, positionCode?: string | null) {
  return MENU.filter((m) => m.roles.includes(role) && (!m.positions || role === "owner" || (!!positionCode && m.positions.includes(positionCode))));
}

// ---------- Sidebar navigasi dua tingkat ----------
// Hanya navigasi. Menu yang tampil memakai role dari MENU di atas (aturan akses yang sudah ada);
// keamanan sebenarnya tetap di database dan di tiap halaman.
export type NavGroupDef = { id: string; label: string; hrefs: { label: string; href: string }[] };

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "laporan",
    label: "Laporan",
    hrefs: [
      { label: "Laporan Hari Ini", href: "/laporan" },
      { label: "Riwayat Laporan", href: "/riwayat" },
    ],
  },
  {
    id: "kehadiran",
    label: "Kehadiran",
    hrefs: [
      { label: "Presensi", href: "/presensi" },
      { label: "Cuti / Izin", href: "/cuti" },
      { label: "Kalender Cuti", href: "/cuti/kalender" },
      { label: "Rekap Presensi", href: "/presensi/rekap" },
      { label: "Ringkasan Presensi", href: "/presensi/ringkasan" },
      { label: "Persetujuan Cuti/Izin", href: "/cuti/persetujuan" },
    ],
  },
  {
    id: "iklan",
    label: "Iklan",
    hrefs: [{ label: "Kalkulator Budget", href: "/budget" }],
  },
  {
    id: "meeting",
    label: "Meeting",
    hrefs: [
      { label: "Notulensi", href: "/notulensi" },
      { label: "Tugas Saya", href: "/tugas" },
      { label: "Daftar Tindak Lanjut", href: "/tindak-lanjut" },
    ],
  },
  {
    id: "kinerja",
    label: "Kinerja Tim",
    hrefs: [
      { label: "Dashboard Tim", href: "/dashboard" },
      { label: "Pantauan Kendala", href: "/pantauan" },
      { label: "Atur Target", href: "/target" },
      { label: "Tarikan Mingguan", href: "/owner/tarikan" },
    ],
  },
  {
    id: "informasi",
    label: "Pusat Informasi",
    hrefs: [
      { label: "Panduan", href: "/panduan" },
      { label: "Kelola Tautan", href: "/tautan" },
    ],
  },
  {
    id: "administrasi",
    label: "Administrasi",
    hrefs: [
      { label: "Company", href: "/owner/company" },
      { label: "Pengguna", href: "/owner/pengguna" },
      { label: "Undangan Karyawan", href: "/owner/undangan" },
      { label: "Hari Libur", href: "/libur" },
      { label: "Pratinjau Form", href: "/laporan/pratinjau" },
    ],
  },
];

export type NavItem = { label: string; href: string };
export type NavGroup = { id: string; label: string; items: NavItem[] };

// Folder dan menu yang boleh dilihat role ini; folder tanpa menu terlihat disembunyikan.
export function navFor(role: UserRole, positionCode?: string | null): NavGroup[] {
  const allowed = new Set(menuFor(role, positionCode).map((m) => m.href));
  return NAV_GROUPS.map((g) => ({ id: g.id, label: g.label, items: g.hrefs.filter((h) => allowed.has(h.href)) })).filter(
    (g) => g.items.length > 0,
  );
}
