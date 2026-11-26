import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handleError } from "@/lib/errors";
import { dummyVerify, verifyPassword } from "@/lib/auth/password";
import {
  ROLE_HOME,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlSeconds,
  signSession,
} from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const bodySchema = z
  .object({ email: z.string().trim().toLowerCase().min(3).max(254), password: z.string().min(1).max(200) })
  .strict();

export async function POST(req: Request) {
  try {
    const raw: unknown = await req.json().catch(() => {
      throw new ApiError(400, "validation_error");
    });
    const { email, password } = bodySchema.parse(raw);
    const ip = clientIp(req);
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { clinic: { select: { active: true } } },
    });

    if (!user) {
      await dummyVerify(password); // iguala el tiempo de respuesta
      await prisma.auditLog.create({ data: { action: "login.failed", data: { reason: "unknown" }, ip } });
      throw new ApiError(401, "invalid_credentials");
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await prisma.auditLog.create({
        data: { actorUserId: user.id, action: "login.failed", data: { reason: "locked" }, ip },
      });
      const retry = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
      throw new ApiError(429, "account_locked", undefined, { "Retry-After": String(retry) });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    const usable = user.active && !(user.role === "clinica" && !user.clinic?.active);

    if (!ok || !usable) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "login.failed",
          data: { reason: ok ? "inactive" : "bad_password" },
          ip,
        },
      });
      if (!ok) {
        // Incremento atomico; al llegar a 5 se bloquea 15 min y el contador vuelve a 0.
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: { increment: 1 } },
          select: { failedLoginCount: true },
        });
        if (updated.failedLoginCount >= MAX_FAILS) {
          const until = new Date(now.getTime() + LOCK_MINUTES * 60_000);
          await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: until, failedLoginCount: 0 } });
          await prisma.auditLog.create({
            data: { actorUserId: user.id, action: "user.locked", entityType: "user", entityId: user.id, ip },
          });
          throw new ApiError(429, "account_locked", undefined, { "Retry-After": String(LOCK_MINUTES * 60) });
        }
      }
      throw new ApiError(401, "invalid_credentials");
    }

    const ttl = sessionTtlSeconds(user.role);
    const expiresAt = new Date(now.getTime() + ttl * 1000);
    const userAgent = req.headers.get("user-agent")?.slice(0, 400) ?? null;

    const session = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
      });
      const s = await tx.session.create({
        data: { userId: user.id, expiresAt, userAgent, ip },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: { actorUserId: user.id, action: "login.success", entityType: "session", entityId: s.id, ip },
      });
      return s;
    });

    const token = await signSession({
      sid: session.id,
      uid: user.id,
      role: user.role,
      ...(user.clinicId ? { cid: user.clinicId } : {}),
      ...(user.producerId ? { pid: user.producerId } : {}),
      exp: Math.floor(expiresAt.getTime() / 1000),
    });

    const res = NextResponse.json({
      role: user.role,
      locale: user.locale,
      must_change_password: user.mustChangePassword,
      home: user.mustChangePassword ? "/cambiar-clave" : ROLE_HOME[user.role],
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(ttl));
    return res;
  } catch (e) {
    return handleError(e);
  }
}
