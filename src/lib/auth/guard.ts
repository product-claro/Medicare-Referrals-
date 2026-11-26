import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ROLE_HOME, SESSION_COOKIE, sessionTtlSeconds, verifySessionToken, type Role } from "./session";

export interface AuthSession {
  sessionId: string;
  userId: string;
  role: Role;
  clinicId: string | null;
  producerId: string | null;
  fullName: string;
  email: string;
  locale: "es" | "en";
  mustChangePassword: boolean;
}

const TOUCH_INTERVAL_MS = 60_000;

// Autorizacion real: valida la cookie Y la fila en sessions/users. Devuelve null si algo falla.
export async function getSession(): Promise<AuthSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const row = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: { include: { clinic: { select: { active: true } } } } },
  });
  const now = new Date();
  if (!row || row.userId !== payload.uid || row.revokedAt || row.expiresAt <= now) return null;
  const u = row.user;
  if (!u.active) return null;
  if (u.role === "clinica" && !u.clinic?.active) return null;
  // El rol de la cookie debe coincidir con el actual en la base.
  if (u.role !== payload.role) return null;

  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Ventana deslizante, como maximo una vez por minuto; best effort.
    await prisma.session
      .update({
        where: { id: row.id },
        data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + sessionTtlSeconds(u.role) * 1000) },
      })
      .catch(() => undefined);
  }

  return {
    sessionId: row.id,
    userId: u.id,
    role: u.role,
    clinicId: u.clinicId,
    producerId: u.producerId,
    fullName: u.fullName,
    email: u.email,
    locale: u.locale,
    mustChangePassword: u.mustChangePassword,
  };
}

interface GuardOptions {
  /** Permite entrar aunque must_change_password sea true (cambio de clave, logout, me). */
  allowMustChange?: boolean;
}

// Para route handlers: lanza ApiError (401 / 403) que handleError convierte en respuesta.
export async function requireSession(roles?: Role[], opts: GuardOptions = {}): Promise<AuthSession> {
  const s = await getSession();
  if (!s) throw new ApiError(401, "unauthorized");
  if (s.mustChangePassword && !opts.allowMustChange) throw new ApiError(403, "password_change_required");
  if (roles && !roles.includes(s.role)) throw new ApiError(403, "forbidden");
  return s;
}

// Para server components / layouts: redirige en vez de lanzar.
export async function requirePageSession(roles?: Role[], opts: GuardOptions = {}): Promise<AuthSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.mustChangePassword && !opts.allowMustChange) redirect("/cambiar-clave");
  if (roles && !roles.includes(s.role)) redirect(ROLE_HOME[s.role]);
  return s;
}
