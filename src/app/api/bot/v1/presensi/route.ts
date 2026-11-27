import { callBot, commonParams, textParam } from "@/lib/bot-api";

// GET /api/bot/v1/presensi?from&to&company&employee&limit&cursor — status, jam masuk/pulang, catatan. TANPA foto dan GPS.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const common = commonParams(url);
  if (common instanceof Response) return common;
  return callBot(request, "bot_presensi", { ...common, p_employee: textParam(url, "employee", 50) });
}
