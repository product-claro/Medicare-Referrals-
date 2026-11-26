import { handleError } from "@/lib/errors";
import { json, queryObject, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { activeFilterQuery, createClinicSchema } from "@/lib/referrals/schemas";
import { createClinic, listClinics } from "@/lib/directory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireSession(["maestro"]);
    const q = activeFilterQuery("all").parse(queryObject(req));
    return json(await listClinics(q.active));
  } catch (e) {
    return handleError(e);
  }
}

// Crea la clinica y su primer usuario (contrasena temporal que se muestra una sola vez).
export async function POST(req: Request) {
  try {
    const s = await requireSession(["maestro"]);
    const body = createClinicSchema.parse(await readJson(req));
    return json(await createClinic(s.userId, body), 201);
  } catch (e) {
    return handleError(e);
  }
}
