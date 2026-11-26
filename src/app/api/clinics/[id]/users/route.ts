import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { createClinicUserSchema } from "@/lib/referrals/schemas";
import { createClinicUser, listClinicUsers } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Personal de una clinica: varias personas pueden tener su propio login y ven el mismo pool de referidos.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(["maestro"]);
    const id = parseId(params.id);
    return json(await listClinicUsers(id));
  } catch (e) {
    return handleError(e);
  }
}

// Crea un usuario de acceso para una clinica ya existente (contrasena temporal, se muestra una sola vez).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = createClinicUserSchema.parse(await readJson(req));
    return json(await createClinicUser(s.userId, id, body), 201);
  } catch (e) {
    return handleError(e);
  }
}
