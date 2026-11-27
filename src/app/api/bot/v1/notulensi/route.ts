import { callBot, commonParams } from "@/lib/bot-api";

// GET /api/bot/v1/notulensi — notulensi meeting (isi sama dengan Tarikan Notulensi JSON), berhalaman.
// ?from&to&company&limit&cursor
export async function GET(request: Request) {
  const common = commonParams(new URL(request.url));
  if (common instanceof Response) return common;
  return callBot(request, "bot_notulensi", common);
}
