import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleError } from "@/lib/errors";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await requireSession(undefined, { allowMustChange: true });
    const [clinic, producer] = await Promise.all([
      s.clinicId ? prisma.clinic.findUnique({ where: { id: s.clinicId }, select: { id: true, name: true } }) : null,
      s.producerId
        ? prisma.producer.findUnique({
            where: { id: s.producerId },
            select: { id: true, fullName: true, producerType: true },
          })
        : null,
    ]);
    return NextResponse.json({
      id: s.userId,
      full_name: s.fullName,
      email: s.email,
      role: s.role,
      clinic,
      producer: producer && { id: producer.id, full_name: producer.fullName, producer_type: producer.producerType },
      locale: s.locale,
      must_change_password: s.mustChangePassword,
    });
  } catch (e) {
    return handleError(e);
  }
}
