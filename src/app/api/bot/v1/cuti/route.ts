import { callBot, commonParams, textParam } from "@/lib/bot-api";

// GET /api/bot/v1/cuti?from&to&company&employee&limit&cursor — pengajuan cuti/izin yang bersinggungan dengan rentang.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const common = commonParams(url);
  if (common instanceof Response) return common;
  return callBot(request, "bot_cuti", { ...common, p_employee: textParam(url, "employee", 50) });
}
