import { handleError } from "@/lib/errors";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { listUnassigned } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

// Bandeja unica de referidos 'nuevo' de todas las clinicas, mas antiguos primero.
export async function GET() {
  try {
    const s = await requireSession(["maestro"]);
    return json(await listUnassigned(s));
  } catch (e) {
    return handleError(e);
  }
}
