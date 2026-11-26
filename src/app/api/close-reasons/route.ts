import { prisma } from "@/lib/db";
import { handleError } from "@/lib/errors";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// Catalogo activo de motivos por estado final.
export async function GET() {
  try {
    await requireSession(["clinica", "maestro", "productor"]);
    const rows = await prisma.closeReason.findMany({
      where: { active: true },
      orderBy: [{ appliesTo: "asc" }, { sortOrder: "asc" }],
    });
    return json({
      items: rows.map((r) => ({
        code: r.code,
        applies_to: r.appliesTo,
        label_es: r.labelEs,
        label_en: r.labelEn,
        requires_detail: r.requiresDetail,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
