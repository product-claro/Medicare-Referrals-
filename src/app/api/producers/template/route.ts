import { handleError } from "@/lib/errors";
import { requireSession } from "@/lib/auth/guard";
import { buildProducerTemplate } from "@/lib/producers-import";

export const dynamic = "force-dynamic";

// Plantilla .xlsx para la carga masiva de productores. Requiere sesion de maestro
// (no es publica: expone la forma esperada de los datos del directorio interno).
export async function GET() {
  try {
    await requireSession(["maestro"]);
    const buf = await buildProducerTemplate();
    // Ver nota en producers-import.ts: exceljs contamina el tipo global Buffer.
    return new Response(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla_productores.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
