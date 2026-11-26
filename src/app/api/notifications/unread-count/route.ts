import { handleError } from "@/lib/errors";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { unreadCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Contador ligero para el badge del encabezado.
export async function GET() {
  try {
    const s = await requireSession(["productor"]);
    return json({ count: await unreadCount(s) });
  } catch (e) {
    return handleError(e);
  }
}
