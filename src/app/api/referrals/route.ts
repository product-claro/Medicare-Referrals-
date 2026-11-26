import { handleError } from "@/lib/errors";
import { json, queryObject, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { createReferralSchema, listQuerySchema } from "@/lib/referrals/schemas";
import { createReferral, listReferrals } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

// Lista con alcance por rol (clinica: su clinica; productor: sus asignados; maestro: todos).
export async function GET(req: Request) {
  try {
    const s = await requireSession(["clinica", "maestro", "productor"]);
    const q = listQuerySchema.parse(queryObject(req));
    return json(await listReferrals(s, q));
  } catch (e) {
    return handleError(e);
  }
}

// Registra un paciente (solo clinica). Body estricto: cualquier otra llave -> 400 unknown_field_rejected.
export async function POST(req: Request) {
  try {
    const s = await requireSession(["clinica"]);
    const input = createReferralSchema.parse(await readJson(req));
    return json(await createReferral(s, input), 201);
  } catch (e) {
    return handleError(e);
  }
}
