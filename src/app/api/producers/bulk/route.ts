import { handleError } from "@/lib/errors";
import { json } from "@/lib/http";
import { requireSession } from "@/lib/auth/guard";
import { ApiError } from "@/lib/errors";
import { bulkCreateProducers, MAX_FILE_BYTES } from "@/lib/producers-import";

export const dynamic = "force-dynamic";

// Carga masiva de productores desde un archivo .xlsx (ver /api/producers/template).
// Procesa fila por fila: una fila invalida no aborta el archivo completo.
export async function POST(req: Request) {
  try {
    const s = await requireSession(["maestro"]);
    const form = await req.formData().catch(() => {
      throw new ApiError(400, "file_required");
    });
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) throw new ApiError(400, "file_required");
    if (file.size > MAX_FILE_BYTES) throw new ApiError(400, "file_too_large");

    const buf = Buffer.from(await file.arrayBuffer());
    const results = await bulkCreateProducers(s.userId, buf);
    const created = results.filter((r) => r.status === "created").length;
    return json({ items: results, created, errors: results.length - created, total: results.length });
  } catch (e) {
    return handleError(e);
  }
}
