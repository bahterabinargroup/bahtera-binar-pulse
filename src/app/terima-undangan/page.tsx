import { AuthCard, FormMessage } from "@/components/AuthCard";
import { AcceptForm } from "./AcceptForm";

// Halaman penerima link undangan yang dibagikan manual (mis. lewat WhatsApp).
// Link Supabase sekali-pakai baru digunakan setelah tombol diklik.
export default async function TerimaUndanganPage({ searchParams }: PageProps<"/terima-undangan">) {
  const tokenHash = (await searchParams).token_hash;
  const token = typeof tokenHash === "string" ? tokenHash : "";

  return (
    <AuthCard title="Undangan Daily Report" subtitle="Anda diundang memakai aplikasi laporan harian. Klik tombol di bawah untuk membuat password dan mulai.">
      {token ? (
        <AcceptForm tokenHash={token} />
      ) : (
        <FormMessage type="error">Link tidak lengkap. Minta admin mengirim link undangan baru.</FormMessage>
      )}
    </AuthCard>
  );
}
