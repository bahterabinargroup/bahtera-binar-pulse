import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Panduan · Bahtera Binar Pulse" };

// Panduan pemakaian untuk karyawan, Manager, dan Owner.
// Halaman ini PUBLIK (tanpa login) agar bisa dibagikan bersama link undangan.
const SECTIONS: { id: string; title: string; badge?: string; body: React.ReactNode }[] = [
  {
    id: "masuk",
    title: "1. Pertama kali masuk",
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Admin mengirim <b>link undangan</b> lewat WhatsApp atau email. Buka link itu di ponsel atau komputer Anda.</li>
          <li>Klik tombol <b>&quot;Lanjutkan &amp; buat password&quot;</b>.</li>
          <li>Ketik password baru (minimal 8 karakter), ulangi sekali, lalu klik <b>Simpan password</b>. Ikon mata 👁 menampilkan atau menyembunyikan tulisannya.</li>
          <li>Selesai. Anda langsung masuk dan melihat Beranda.</li>
        </ol>
        <Tip>
          Link undangan hanya bisa dipakai <b>sekali</b> dan ada batas waktunya. Kalau muncul pesan &quot;kedaluwarsa&quot;, minta admin
          mengirim link baru.
        </Tip>
        <p className="mt-3">
          <b>Masuk di hari berikutnya:</b> buka alamat aplikasi, isi email dan password, lalu klik <b>Masuk</b>.
        </p>
        <p className="mt-3">
          <b>Pasang di layar utama ponsel</b> supaya mudah dibuka seperti aplikasi: di Chrome (Android) ketuk menu <b>⋮</b>, lalu
          <b> Tambahkan ke layar utama</b>. Di Safari (iPhone) ketuk tombol <b>Bagikan</b>, lalu <b>Tambah ke Layar Utama</b>.
        </p>
      </>
    ),
  },
  {
    id: "laporan",
    title: "2. Mengisi Laporan Hari Ini",
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Di Beranda, ketuk <b>Laporan Hari Ini</b>. Form yang muncul otomatis sesuai <b>jabatan</b> Anda.</li>
          <li>Isi bagian demi bagian: Aktivitas, Input Wajib Harian, lalu Review dan Kendala.</li>
          <li>Ketuk <b>Simpan</b> di bagian bawah layar. Anda boleh menyimpan <b>berkali-kali</b> sepanjang hari, tidak perlu menunggu selesai.</li>
          <li>Setelah tersimpan, muncul tulisan hijau <b>&quot;✓ Tersimpan pukul ...&quot;</b>.</li>
        </ol>
        <h4 className="mt-4 font-bold text-accent">Hal yang perlu diketahui</h4>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Tombol &quot;+ Tambah baris&quot;</b> menambah baris aktivitas. Tanda <b>×</b> menghapus baris. Baris yang kosong semua tidak ikut tersimpan.</li>
          <li><b>Status</b> (Sudah / Belum): ketuk kotak kecil bertanda &quot;?&quot; lalu pilih. Pilihan <b>Belum</b> tampil merah dan tetap boleh disimpan.</li>
          <li><b>&quot;Belum lengkap&quot;</b> (tulisan kuning) artinya isian wajib masih kosong. Laporan tetap bisa disimpan, tetapi usahakan dilengkapi.</li>
          <li><b>Angka</b> boleh ditulis seperti <code>1.500.000</code> atau <code>Rp 1.500.000</code>. <b>Link</b> boleh ditulis tanpa <code>https://</code>, misalnya <code>drive.google.com/...</code>. Kalau formatnya salah, kolomnya ditandai merah beserta penjelasannya.</li>
          <li><b>Hanya hari ini.</b> Laporan hanya bisa dibuat dan diubah pada tanggal hari ini (WIB). Mulai besok, laporan itu <b>terkunci</b>. Kalau terlupa, minta Owner mengoreksinya.</li>
          <li>Kalau tanggal berganti saat Anda masih mengetik, muncul pesan &quot;Hari sudah berganti, laporan ini terkunci&quot;. Tulisan Anda <b>tidak dihapus</b>, jadi bisa disalin dulu.</li>
          <li>Kalau Anda menutup halaman sebelum menyimpan, browser akan mengingatkan.</li>
        </ul>
        <Tip>Isi laporan sedikit demi sedikit sepanjang hari lebih mudah daripada sekaligus di akhir hari.</Tip>
      </>
    ),
  },
  {
    id: "riwayat",
    title: "3. Riwayat Laporan",
    body: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>Ketuk <b>Riwayat Laporan</b> di Beranda. Daftar laporan Anda tampil dari yang terbaru.</li>
        <li>Label hijau <b>&quot;Hari ini · bisa diedit&quot;</b> berarti laporan hari ini. Label abu-abu <b>🔒 Terkunci</b> berarti hari yang sudah lewat.</li>
        <li>Ketuk satu laporan untuk membukanya. Laporan lama hanya bisa dibaca. Laporan hari ini punya tombol <b>Edit laporan hari ini</b>.</li>
      </ol>
    ),
  },
  {
    id: "notulensi",
    title: "4. Notulensi Meeting",
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Ketuk <b>Notulensi</b>, lalu <b>+ Buat Notulensi</b>.</li>
          <li>Isi <b>Nama meeting</b> terlebih dulu. Setelah itu notulensi <b>tersimpan otomatis</b> beberapa detik setelah Anda berhenti mengetik. Ketuk <b>Simpan</b> kalau ingin menyimpan sekarang.</li>
          <li>Isi tanggal, jam, <b>Lokasi</b> (Kantor 1, Kantor 2, atau Online lengkap dengan link), peserta, agenda, pembahasan, dan keputusan.</li>
          <li><b>Peserta:</b> pilih rekan dari daftar, atau ketik nama tamu yang tidak punya akun.</li>
          <li><b>Tindak lanjut:</b> tulis tugasnya, pilih <b>PIC</b> (orang yang bertanggung jawab), tenggat, dan statusnya.</li>
          <li>Di akhir meeting, ketuk <b>Submit</b>. Notulensi lalu <b>terkunci</b> dan tidak bisa diubah lagi (hanya Owner yang bisa mengoreksi). Pastikan isinya sudah benar sebelum Submit.</li>
          <li>Ketuk <b>⬇ Download PDF</b> di halaman notulensi untuk mengunduh dan membagikannya.</li>
        </ol>
        <h4 className="mt-4 font-bold text-accent">Siapa yang bisa melihat notulensi?</h4>
        <p>Penulisnya, Manager di company yang sama, dan Owner. Rekan lain tidak melihatnya.</p>
        <h4 className="mt-4 font-bold text-accent">Ingin menghapus notulensi?</h4>
        <p>
          Ketuk <b>Ajukan hapus</b> dan tulis alasannya. Notulensi <b>tetap ada</b> sampai Owner menyetujui. Anda bisa membatalkan
          permintaan itu kapan saja.
        </p>
      </>
    ),
  },
  {
    id: "tugas",
    title: "5. Tugas Saya",
    body: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>Kalau seseorang menunjuk Anda sebagai <b>PIC</b> pada tindak lanjut meeting, tugasnya muncul di <b>Tugas Saya</b>, urut dari tenggat terdekat.</li>
        <li>Tugas yang <b>lewat tenggat</b> dan belum selesai ditandai merah.</li>
        <li>Ubah <b>status</b> langsung di kotak di sebelah kanan tugas: Open, Sedang dikerjakan, atau Selesai. Anda hanya bisa mengubah status, bukan isi tugas atau tenggatnya.</li>
        <li>Ketuk <b>&quot;Tampilkan juga tugas yang sudah selesai&quot;</b> untuk melihat yang sudah rampung.</li>
      </ol>
    ),
  },
  {
    id: "manager",
    title: "6. Untuk Manager: Dashboard Tim",
    badge: "Manager & Owner",
    body: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>Ketuk <b>Dashboard Tim</b>. Secara bawaan yang tampil adalah hari ini; pilih tanggal lain atau ketuk <b>← Kemarin</b>.</li>
        <li><b>Belum mengisi</b> menampilkan siapa saja yang belum melapor pada tanggal itu.</li>
        <li><b>Laporan masuk:</b> ketuk <b>Lihat →</b> untuk membaca laporan anggota tim (hanya baca).</li>
        <li><b>Kepatuhan minggu ini</b> memperlihatkan jumlah hari terisi dan persentasenya: hijau 100%, kuning 80–99%, merah di bawah 80%.</li>
        <li>Manager hanya melihat company-nya sendiri.</li>
      </ol>
    ),
  },
  {
    id: "owner",
    title: "7. Untuk Owner: mengelola aplikasi",
    badge: "Owner",
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Company:</b> tambah, ubah, atau nonaktifkan holding dan anak usaha.</li>
          <li>
            <b>Undangan Karyawan:</b> isi email, nama, company, role, dan jabatan, lalu <b>Kirim undangan</b>. Kalau email tertahan,
            ketuk <b>🔗 Salin link undangan</b> dan kirim lewat WhatsApp. Untuk akun yang <b>Belum pernah masuk</b>, ketuk
            <b> 🔑 Salin link atur password</b>.
          </li>
          <li><b>Pengguna:</b> ubah role (Karyawan / Manager / Owner), jabatan, atau nonaktifkan akun yang sudah tidak bekerja.</li>
          <li><b>Koreksi laporan lama:</b> buka laporan lewat Dashboard Tim, lalu ketuk <b>Koreksi (Owner)</b>.</li>
          <li><b>Tarikan Mingguan:</b> lihat laporan satu minggu dan unduh sebagai CSV (Excel) atau JSON.</li>
          <li><b>Pratinjau Form:</b> melihat form setiap jabatan tanpa menyimpan.</li>
        </ul>
        <Tip>
          <b>Role</b> menentukan apa yang boleh dilihat dan dilakukan. <b>Jabatan</b> menentukan form laporan yang muncul. Keduanya
          bisa diatur terpisah.
        </Tip>
      </>
    ),
  },
  {
    id: "faq",
    title: "8. Pertanyaan yang sering muncul",
    body: (
      <dl className="space-y-4">
        <Faq q="Saya lupa password.">
          Di halaman Masuk ketuk <b>Lupa password?</b>, isi email Anda, lalu buka email dari sistem dan ikuti link-nya. Kalau email tidak
          datang, minta admin membuatkan link atur password.
        </Faq>
        <Faq q="Muncul &quot;Akun Anda belum terdaftar. Hubungi admin.&quot;">
          Email Anda belum diundang atau akunnya sudah dinonaktifkan. Hubungi admin.
        </Faq>
        <Faq q="Link undangan bilang kedaluwarsa atau sudah dipakai.">
          Minta admin membuat link baru. Link hanya berlaku sekali dan dalam waktu terbatas.
        </Faq>
        <Faq q="Laporan kemarin tidak bisa saya ubah.">
          Itu memang aturannya: laporan hanya bisa diubah pada hari yang sama. Untuk koreksi, minta Owner.
        </Faq>
        <Faq q="Menu Dashboard Tim tidak ada di Beranda saya.">
          Dashboard hanya untuk Manager dan Owner.
        </Faq>
        <Faq q="Saya tidak bisa melihat notulensi rekan.">
          Notulensi hanya terlihat oleh penulisnya, Manager di company yang sama, dan Owner.
        </Faq>
        <Faq q="Notulensi saya tidak bisa diubah lagi.">
          Notulensi yang sudah di-Submit terkunci. Minta Owner kalau perlu dikoreksi.
        </Faq>
        <Faq q="Tulisan saya hilang.">
          Selama ada tulisan &quot;Tersimpan&quot; berwarna hijau, isiannya aman. Kalau tidak yakin, ketuk <b>Simpan</b> sebelum menutup halaman.
        </Faq>
      </dl>
    ),
  },
];

function Tip({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg border-l-4 border-gold bg-amber-50 p-3 text-sm text-zinc-800">💡 {children}</p>;
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-bold text-accent">{q}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export default function PanduanPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <header className="rounded-xl border border-zinc-200 border-t-4 border-t-gold bg-white p-6 text-center shadow-sm">
        <Image
          src="/brand/logo-utama.png"
          alt="Bahtera Binar Group"
          width={1144}
          height={746}
          priority
          className="mx-auto h-28 w-auto"
        />
        <p className="mt-1 text-xs font-bold tracking-[0.25em] text-gold">BAHTERA BINAR PULSE</p>
        <h1 className="mt-3 text-2xl font-bold text-accent">Panduan Pemakaian</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Aplikasi untuk laporan harian, notulensi meeting, dan tugas tim. Pilih bagian di bawah untuk langsung ke langkahnya.
        </p>
      </header>

      <nav aria-label="Daftar isi" className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-bold">Isi panduan</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-accent underline decoration-gold underline-offset-2">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 space-y-4">
        {SECTIONS.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-4 rounded-xl border border-zinc-200 bg-white p-5 text-[15px] leading-relaxed shadow-sm"
          >
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-accent">
              {s.title}
              {s.badge && <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-bold text-accent">{s.badge}</span>}
            </h2>
            <div className="mt-3">{s.body}</div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-bold text-accent underline decoration-gold underline-offset-2">
          ← Buka aplikasi
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-zinc-500">Ada kendala atau pertanyaan? Hubungi admin.</p>
    </main>
  );
}
