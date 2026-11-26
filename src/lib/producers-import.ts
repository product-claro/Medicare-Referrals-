import ExcelJS from "exceljs";
import { ApiError } from "./errors";
import { createProducer } from "./directory";
import { createProducerSchema } from "./referrals/schemas";

// Carga masiva de productores por Excel. Orden de columnas fijo (no se lee por nombre de encabezado,
// para no depender del idioma ni de que el usuario reordene columnas): A nombre, B tipo, C NPN, D telefono, E correo.
const MAX_ROWS = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const HEADERS = ["Nombre completo", "Tipo (dependiente/independiente)", "NPN (opcional)", "Telefono (opcional)", "Correo (opcional)"];
const EXAMPLE_ROW = ["Juan Perez", "dependiente", "1234567", "+13055551234", "juan.perez@ejemplo.com"];

export async function buildProducerTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Productores");
  sheet.columns = HEADERS.map((h) => ({ header: h, width: Math.max(18, h.length + 2) }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(EXAMPLE_ROW);
  sheet.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };

  const info = wb.addWorksheet("Instrucciones");
  info.columns = [{ width: 100 }];
  info.addRows([
    ["No incluyas numero de Medicare ni de Medicaid en ninguna columna; la fila se rechaza si lo detecta."],
    ["Columna B (Tipo) debe ser exactamente 'dependiente' o 'independiente'."],
    ["El telefono, si lo llenas, debe tener formato internacional: +1 seguido del numero (ej. +13055551234)."],
    ["El correo es opcional. Si lo llenas, se crea el usuario de acceso del productor con una contrasena temporal."],
    ["Borra la fila de ejemplo (fila 2) antes de subir tu propio archivo, o dejala y se procesara como un productor mas."],
    [`Maximo ${MAX_ROWS} filas por archivo.`],
  ]);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

interface ParsedRow {
  excelRow: number;
  raw: Record<string, unknown>;
}

function cellText(row: ExcelJS.Row, col: number): string | undefined {
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return undefined;
  const s = typeof v === "object" && "text" in (v as object) ? String((v as { text: unknown }).text) : String(v);
  const trimmed = s.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function parseProducerWorkbook(buf: Buffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    // El .d.ts de exceljs declara su propio tipo "Buffer" (local al modulo, no el global de Node)
    // que exige miembros de ArrayBuffer que un Buffer real no tiene; se evita con un cast a any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buf as any);
  } catch {
    throw new ApiError(400, "invalid_file");
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw new ApiError(400, "invalid_file");

  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const full_name = cellText(row, 1);
    const producer_type = cellText(row, 2)?.toLowerCase();
    const npn = cellText(row, 3);
    const phone = cellText(row, 4);
    const email = cellText(row, 5)?.toLowerCase();
    if (!full_name && !producer_type && !npn && !phone && !email) return; // fila vacia, se ignora
    rows.push({
      excelRow: rowNumber,
      raw: {
        full_name,
        producer_type,
        ...(npn !== undefined ? { npn } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
      },
    });
  });

  if (rows.length === 0) throw new ApiError(400, "no_rows");
  if (rows.length > MAX_ROWS) throw new ApiError(400, "too_many_rows");
  return rows;
}

export interface ProducerImportResult {
  row: number;
  status: "created" | "error";
  full_name?: string;
  email?: string;
  temp_password?: string;
  error_code?: string;
  error_fields?: Record<string, string>;
}

export async function bulkCreateProducers(actorUserId: string, buf: Buffer): Promise<ProducerImportResult[]> {
  const rows = await parseProducerWorkbook(buf);
  const results: ProducerImportResult[] = [];

  // Secuencial (no paralelo): preserva el orden de auditoria y hace que un NPN/correo duplicado
  // *dentro del mismo archivo* lo detecte la restriccion unica de la base en la segunda ocurrencia.
  for (const { excelRow, raw } of rows) {
    const parsed = createProducerSchema.safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_"] = issue.message;
      results.push({ row: excelRow, status: "error", error_code: "validation_error", error_fields: fields });
      continue;
    }
    try {
      const created = await createProducer(actorUserId, parsed.data);
      results.push({
        row: excelRow,
        status: "created",
        full_name: created.full_name,
        email: created.user?.email,
        temp_password: "temp_password" in created ? (created as { temp_password?: string }).temp_password : undefined,
      });
    } catch (e) {
      if (e instanceof ApiError) {
        results.push({ row: excelRow, status: "error", error_code: e.code });
        continue;
      }
      // Violacion de unicidad / constraint de la base: reportar por fila en vez de abortar el archivo.
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        results.push({ row: excelRow, status: "error", error_code: "duplicate" });
      } else if (message.includes("contains_mbi")) {
        results.push({ row: excelRow, status: "error", error_code: "mbi_not_allowed" });
      } else {
        results.push({ row: excelRow, status: "error", error_code: "internal_error" });
      }
    }
  }
  return results;
}

export { MAX_FILE_BYTES };
