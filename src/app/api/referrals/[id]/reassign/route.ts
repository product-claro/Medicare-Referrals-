import { handleError } from "@/lib/errors";
import { json, parseId, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { reassignSchema } from "@/lib/referrals/schemas";
import { reassignReferral } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["maestro"]);
    const id = parseId(params.id);
    const body = reassignSchema.parse(await readJson(req));
    return json(await reassignReferral(s, id, body));
  } catch (e) {
    return handleError(e);
  }
}
