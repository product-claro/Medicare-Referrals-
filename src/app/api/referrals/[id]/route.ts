import { handleError } from "@/lib/errors";
import { json, parseId } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { getReferral } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

// Fuera de alcance o inexistente -> 404 (no 403) para no revelar que existe.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const s = await requireSession(["clinica", "maestro", "productor"]);
    return json(await getReferral(s, parseId(params.id)));
  } catch (e) {
    return handleError(e);
  }
}
