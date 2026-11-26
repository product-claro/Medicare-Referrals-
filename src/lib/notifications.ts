import { prisma } from "./db";
import { ApiError } from "./errors";
import type { AuthSession } from "./auth/guard";

// Avisos al productor. Los crea el trigger de la base al asignar/reasignar (kind + params, sin MBI).
// La API devuelve kind + params; el texto se arma en la interfaz con el diccionario del idioma del usuario.

function view(n: {
  id: string;
  kind: string;
  params: unknown;
  referralId: string | null;
  createdAt: Date;
  readAt: Date | null;
}) {
  return {
    id: n.id,
    kind: n.kind,
    params: n.params as Record<string, string | number>,
    referral_id: n.referralId,
    created_at: n.createdAt.toISOString(),
    read_at: n.readAt ? n.readAt.toISOString() : null,
  };
}

export async function listNotifications(s: AuthSession, limit = 100) {
  const rows = await prisma.notification.findMany({
    where: { recipientUserId: s.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  // No leidos primero, luego por fecha (el orden por fecha ya viene de la consulta; el sort es estable).
  const items = rows.map(view).sort((a, b) => Number(a.read_at !== null) - Number(b.read_at !== null));
  return { items, unread: items.filter((i) => !i.read_at).length };
}

export async function unreadCount(s: AuthSession): Promise<number> {
  return prisma.notification.count({ where: { recipientUserId: s.userId, readAt: null } });
}

export async function markRead(s: AuthSession, id: string) {
  const res = await prisma.notification.updateMany({
    where: { id, recipientUserId: s.userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (res.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id, recipientUserId: s.userId }, select: { id: true } });
    if (!exists) throw new ApiError(404, "not_found");
  }
  return { id, read: true };
}

export async function markAllRead(s: AuthSession) {
  await prisma.notification.updateMany({
    where: { recipientUserId: s.userId, readAt: null },
    data: { readAt: new Date() },
  });
}
