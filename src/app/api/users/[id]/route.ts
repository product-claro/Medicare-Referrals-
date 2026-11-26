import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { setUserActiveSchema } from "@/lib/referrals/schemas";
import { setUserActive } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Activa o desactiva cualquier usuario (hoy lo usa la administracion de personal de clinica).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = setUserActiveSchema.parse(await readJson(req));
    return json(await setUserActive(s.userId, id, body.active));
  } catch (e) {
    return handleError(e);
  }
}
