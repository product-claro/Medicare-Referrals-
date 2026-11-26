import { handleError } from "@/lib/errors";
import { json, parseId } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { markRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireSession(["productor"]);
    return json(await markRead(s, parseId(params.id)));
  } catch (e) {
    return handleError(e);
  }
}
