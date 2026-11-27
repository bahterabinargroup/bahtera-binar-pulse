import { callBot, commonParams, textParam } from "@/lib/bot-api";

// GET /api/bot/v1/laporan — laporan harian (isi sama dengan Tarikan Laporan JSON), berhalaman.
// ?from&to&company&position&employee&fields=ringkas&limit&cursor
export async function GET(request: Request) {
  const url = new URL(request.url);
  const common = commonParams(url);
  if (common instanceof Response) return common;
  return callBot(request, "bot_laporan", {
    ...common,
    p_position: textParam(url, "position", 20),
    p_employee: textParam(url, "employee", 50),
    p_fields: textParam(url, "fields", 20),
  });
}
