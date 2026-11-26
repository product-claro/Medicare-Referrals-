import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { updateProducerSchema } from "@/lib/referrals/schemas";
import { updateProducer } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Edita datos o desactiva (active=false). Un productor inactivo no recibe asignaciones.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = updateProducerSchema.parse(await readJson(req));
    return json(await updateProducer(s.userId, id, body));
  } catch (e) {
    return handleError(e);
  }
}
