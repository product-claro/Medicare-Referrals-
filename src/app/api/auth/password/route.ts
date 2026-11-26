import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handleError } from "@/lib/errors";
import { requireSession } from "@/lib/auth/guard";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { clientIp } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({ current_password: z.string().min(1).max(200), new_password: z.string().max(200) })
  .strict();

// Cambia la contrasena propia, limpia must_change_password y revoca las demas sesiones.
export async function POST(req: Request) {
  try {
    const s = await requireSession(undefined, { allowMustChange: true });
    const raw: unknown = await req.json().catch(() => {
      throw new ApiError(400, "validation_error");
    });
    const body = bodySchema.parse(raw);
    if (body.new_password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, "password_too_short", { new_password: "password_too_short" });
    }
    if (body.new_password === body.current_password) throw new ApiError(400, "password_same");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: s.userId } });
    if (!(await verifyPassword(body.current_password, user.passwordHash))) {
      throw new ApiError(400, "wrong_current_password");
    }
    const passwordHash = await hashPassword(body.new_password);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({ where: { id: s.userId }, data: { passwordHash, mustChangePassword: false } }),
      prisma.session.updateMany({
        where: { userId: s.userId, revokedAt: null, id: { not: s.sessionId } },
        data: { revokedAt: now },
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: s.userId,
          action: "password.changed",
          entityType: "user",
          entityId: s.userId,
          ip: clientIp(req),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
