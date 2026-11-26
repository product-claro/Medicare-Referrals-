import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { ApiError } from "@/lib/errors";
import { updateUserSchema } from "@/lib/referrals/schemas";
import { setClinicUserAdmin, setMasterSuperAdmin, setUserActive } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Activa/desactiva un usuario, y/o cambia su rol secundario: administrador de clinica
// (ve todo vs. solo lo propio) o administrador maestro (puede crear otros maestros).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = updateUserSchema.parse(await readJson(req));
    if (body.super_admin !== undefined && !s.superAdmin) throw new ApiError(403, "forbidden");
    let result;
    if (body.active !== undefined) result = await setUserActive(s.userId, id, body.active);
    if (body.clinic_admin !== undefined) result = await setClinicUserAdmin(s.userId, id, body.clinic_admin);
    if (body.super_admin !== undefined) result = await setMasterSuperAdmin(s.userId, id, body.super_admin);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
