import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { assignSchema } from "@/lib/referrals/schemas";
import { assignReferral } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

// Asignacion manual a un productor individual activo. Si ya no esta 'nuevo' -> 409 already_assigned.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = assignSchema.parse(await readJson(req));
    return json(await assignReferral(s, id, body.producer_id));
  } catch (e) {
    return handleError(e);
  }
}
