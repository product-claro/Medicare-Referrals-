import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { ApiError } from "@/lib/errors";
import { updateUserSchema } from "@/lib/referrals/schemas";
import { setClinicUserAdmin, setMasterSuperAdmin, setUserActive, setUserPassword } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Activa/desactiva un usuario, cambia su contrasena a mano, y/o cambia su rol secundario:
// administrador de clinica (ve todo vs. solo lo propio) o administrador maestro (crea otros maestros).
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = updateUserSchema.parse(await readJson(req));
    if (body.super_admin !== undefined && !s.superAdmin) throw new ApiError(403, "forbidden");
    let result;
    if (body.active !== undefined) result = await setUserActive(s.userId, id, body.active);
    if (body.clinic_admin !== undefined) result = await setClinicUserAdmin(s.userId, id, body.clinic_admin);
    if (body.super_admin !== undefined) result = await setMasterSuperAdmin(s.userId, id, body.super_admin);
    if (body.new_password !== undefined) result = await setUserPassword(s.userId, id, body.new_password);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
