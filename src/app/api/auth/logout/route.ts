import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { handleError } from "@/lib/errors";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

// Idempotente: revoca la sesion de la cookie (si es valida) y siempre borra la cookie.
export async function POST(req: Request) {
  try {
    const payload = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
    if (payload) {
      const r = await prisma.session.updateMany({
        where: { id: payload.sid, userId: payload.uid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (r.count > 0) {
        await prisma.auditLog.create({
          data: {
            actorUserId: payload.uid,
            action: "logout",
            entityType: "session",
            entityId: payload.sid,
            ip: clientIp(req),
          },
        });
      }
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  } catch (e) {
    return handleError(e);
  }
}
