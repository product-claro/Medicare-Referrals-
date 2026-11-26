import { handleError } from "@/lib/errors";
import { json, queryObject, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { activeFilterQuery, createProducerSchema } from "@/lib/referrals/schemas";
import { createProducer, listProducers } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Por defecto solo activos, con tipo y carga abierta (para elegir en la bandeja).
export async function GET(req: Request) {
  try {
    await requireSession(["maestro"]);
    const q = activeFilterQuery("true").parse(queryObject(req));
    return json(await listProducers(q.active));
  } catch (e) {
    return handleError(e);
  }
}

// Crea un productor individual y, si viene email, su usuario de acceso (contrasena temporal una sola vez).
export async function POST(req: Request) {
  try {
    const s = await requireSession(["maestro"]);
    const body = createProducerSchema.parse(await readJson(req));
    return json(await createProducer(s.userId, body), 201);
  } catch (e) {
    return handleError(e);
  }
}
