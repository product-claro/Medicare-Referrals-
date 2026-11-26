import { handleError } from "@/lib/errors";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { listNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Avisos del usuario (no leidos primero). Devuelve kind + params; la UI arma el texto en su idioma.
export async function GET() {
  try {
    const s = await requireSession(["productor"]);
    return json(await listNotifications(s));
  } catch (e) {
    return handleError(e);
  }
}
