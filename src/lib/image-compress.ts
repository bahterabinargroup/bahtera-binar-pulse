import { MAX_PHOTO_BYTES } from "./presensi";

// Kompres foto di browser (canvas) sebelum diunggah: foto asli sebesar apa pun
// dikecilkan menjadi JPEG di bawah 200 KB.
export async function compressImage(file: File, maxBytes: number = MAX_PHOTO_BYTES): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Berkas harus berupa foto (JPG, PNG, atau HEIC dari ponsel).");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Foto tidak bisa dibaca. Coba foto lain atau ambil ulang.");
  }

  let side = 1280; // sisi terpanjang awal (px)
  try {
    for (let round = 0; round < 6; round++) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Peramban tidak mendukung pengecilan foto.");
      ctx.fillStyle = "#fff"; // latar putih untuk PNG transparan
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const q of [0.8, 0.7, 0.6, 0.5, 0.4]) {
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
        if (!blob) throw new Error("Gagal mengecilkan foto.");
        if (blob.size <= maxBytes) return blob;
      }
      side = Math.round(side * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Foto terlalu rumit untuk dikecilkan di bawah 200 KB. Coba foto lain.");
}

export function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}
