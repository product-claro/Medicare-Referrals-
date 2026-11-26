import { handleError } from "@/lib/errors";
import { json, queryObject } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { metricsQuerySchema } from "@/lib/referrals/schemas";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

// Conteos y tasa de cierre por clinica y por productor, con filtros from/to (YYYY-MM-DD).
export async function GET(req: Request) {
  try {
    await requireSession(["maestro"]);
    const q = metricsQuerySchema.parse(queryObject(req));
    return json(await getMetrics(q));
  } catch (e) {
    return handleError(e);
  }
}
