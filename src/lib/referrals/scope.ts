import type { Prisma } from "@prisma/client";
import type { AuthSession } from "../auth/guard";

// Unico punto donde se arma el alcance de referrals por rol (criterio 2).
// Ningun handler arma consultas de referrals por su cuenta: todos pasan por aqui.

const NO_MATCH = "00000000-0000-0000-0000-000000000000";

type ScopeSession = Pick<AuthSession, "role" | "clinicId" | "producerId">;

export function referralScope(s: ScopeSession): Prisma.ReferralWhereInput {
  switch (s.role) {
    case "clinica":
      return { clinicId: s.clinicId ?? NO_MATCH };
    case "productor":
      return { producerId: s.producerId ?? NO_MATCH };
    case "maestro":
      return {};
    default:
      return { id: NO_MATCH };
  }
}

export function scoped(s: ScopeSession, where: Prisma.ReferralWhereInput = {}): Prisma.ReferralWhereInput {
  return { AND: [referralScope(s), where] };
}

export const referralInclude = {
  clinic: { select: { id: true, name: true } },
  producer: { select: { id: true, fullName: true, producerType: true, phone: true } },
  createdBy: { select: { id: true, fullName: true } },
  assignedBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ReferralInclude;

export type ReferralRow = Prisma.ReferralGetPayload<{ include: typeof referralInclude }>;
