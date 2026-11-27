import { botError } from "@/lib/bot-api";

// Alamat /api/bot lain yang tidak ada: GET -> 404; metode yang mengubah data selalu ditolak (405).
export async function GET() {
  return botError(404, "Endpoint tidak ditemukan.");
}

const notAllowed = () => botError(405, "API bot hanya untuk membaca (GET).");
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
