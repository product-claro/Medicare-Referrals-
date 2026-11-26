import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { closeSchema } from "@/lib/referrals/schemas";
import { closeReferral } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

// Cierre: inscrito (plan + fechas, motivo automatico) o no_inscrito (motivo del catalogo obligatorio).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["productor", "maestro"]);
    const id = parseId(params.id);
    const body = closeSchema.parse(await readJson(req));
    return json(await closeReferral(s, id, body));
  } catch (e) {
    return handleError(e);
  }
}
