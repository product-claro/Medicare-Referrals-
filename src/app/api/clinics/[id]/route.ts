import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { updateClinicSchema } from "@/lib/referrals/schemas";
import { updateClinic } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Renombra o desactiva (sus usuarios dejan de poder entrar: getSession exige clinica activa).
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = updateClinicSchema.parse(await readJson(req));
    return json(await updateClinic(s.userId, id, body));
  } catch (e) {
    return handleError(e);
  }
}
