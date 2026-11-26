import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { attemptSchema } from "@/lib/referrals/schemas";
import { registerAttempt } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

// Productor asignado (alcance por producer_id; ajeno -> 404) o maestro en su nombre.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["productor", "maestro"]);
    const id = parseId(params.id);
    const body = attemptSchema.parse(await readJson(req));
    return json(await registerAttempt(s, id, body));
  } catch (e) {
    return handleError(e);
  }
}
