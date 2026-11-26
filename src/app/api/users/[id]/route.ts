import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { updateUserSchema } from "@/lib/referrals/schemas";
import { setClinicUserAdmin, setUserActive } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Activa/desactiva un usuario y/o cambia si es administrador de su clinica (ve todo vs. solo lo propio).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = updateUserSchema.parse(await readJson(req));
    let result;
    if (body.active !== undefined) result = await setUserActive(s.userId, id, body.active);
    if (body.clinic_admin !== undefined) result = await setClinicUserAdmin(s.userId, id, body.clinic_admin);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
