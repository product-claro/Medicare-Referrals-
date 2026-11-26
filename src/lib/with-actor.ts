import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

// Toda escritura sobre referrals corre aqui: fija el actor de auditoria dentro de la misma
// transaccion (set_config(..., true) solo vive en la transaccion; sirve con PgBouncer en modo transaction).
export async function withActor<T>(
  actor: { userId: string },
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts: { note?: string | null; data?: Record<string, unknown> } = {},
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_user_id', ${actor.userId}, true), set_config('app.event_note', ${opts.note ?? ""}, true), set_config('app.event_data', ${JSON.stringify(opts.data ?? {})}, true)`;
    return fn(tx);
  });
}
