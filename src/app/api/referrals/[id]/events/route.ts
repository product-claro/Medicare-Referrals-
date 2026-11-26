import { handleError } from "@/lib/errors";
import { json, parseId } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { listEvents } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

// Linea de tiempo de auditoria (quien creo, asigno, contacto y cerro, y cuando).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const s = await requireSession(["maestro"]);
    return json(await listEvents(s, parseId(params.id)));
  } catch (e) {
    return handleError(e);
  }
}
