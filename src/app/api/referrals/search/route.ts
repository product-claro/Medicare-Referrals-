import { handleError } from "@/lib/errors";
import { json, readJson } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { searchSchema } from "@/lib/referrals/schemas";
import { searchReferrals } from "@/lib/referrals/service";

export const dynamic = "force-dynamic";

// POST (no GET): nombre / apellido / telefono viajan en el body, nunca en la URL.
export async function POST(req: Request) {
  try {
    const s = await requireSession(["maestro"]);
    const q = searchSchema.parse(await readJson(req));
    return json(await searchReferrals(s, q));
  } catch (e) {
    return handleError(e);
  }
}
