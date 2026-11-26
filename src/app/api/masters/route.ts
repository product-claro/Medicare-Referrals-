import { handleError, ApiError } from "@/lib/errors";
import { json, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { createMasterSchema } from "@/lib/referrals/schemas";
import { createMaster, listMasters } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Solo un administrador maestro (super_admin) puede ver o crear otras cuentas de maestro.
export async function GET() {
  try {
    const s = await requireSession(["maestro"]);
    if (!s.superAdmin) throw new ApiError(403, "forbidden");
    return json(await listMasters());
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireSession(["maestro"]);
    if (!s.superAdmin) throw new ApiError(403, "forbidden");
    const body = createMasterSchema.parse(await readJson(req));
    return json(await createMaster(s.userId, body), 201);
  } catch (e) {
    return handleError(e);
  }
}
