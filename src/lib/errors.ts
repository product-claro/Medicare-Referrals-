import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

// Todas las respuestas de error: {error:{code, fields?}}; code es una llave de errors.* en los diccionarios.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields?: Record<string, string>,
    public headers?: Record<string, string>,
  ) {
    super(code);
  }
}

export function errorResponse(
  status: number,
  code: string,
  fields?: Record<string, string>,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error: { code, ...(fields ? { fields } : {}) } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

// Codigos que lanzan los triggers de Postgres (RAISE EXCEPTION '<codigo>') y su estado HTTP:
// 409 si dependen del estado actual, 422 en los demas casos.
const TRIGGER_ERRORS: Record<string, number> = {
  referral_already_closed: 409,
  invalid_status_transition: 409,
  close_reason_required: 422,
  close_reason_detail_required: 422,
  only_master_assigns: 422,
  only_clinic_creates_referrals: 422,
  actor_not_assigned_producer: 422,
  producer_inactive_or_unknown: 422,
  cannot_unassign: 422,
  assignment_must_set_status_asignado: 422,
  referral_immutable_field: 422,
  referral_must_start_as_nuevo: 422,
};

// Traduce errores de Prisma / triggers a ApiError. Devuelve null si no es un error conocido.
export function mapDbError(e: unknown): ApiError | null {
  if (!(e instanceof Error) || !e.name.startsWith("PrismaClient")) return null;
  for (const [code, status] of Object.entries(TRIGGER_ERRORS)) {
    if (e.message.includes(code)) return new ApiError(status, code);
  }
  if (e.message.includes("contains_mbi")) return new ApiError(422, "mbi_not_allowed");
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return new ApiError(409, "duplicate");
    if (e.code === "P2025") return new ApiError(404, "not_found");
    if (e.code === "P2003") return new ApiError(422, "invalid_reference");
    if (e.code === "P2004") return new ApiError(422, "constraint_violation");
  }
  if (e.message.includes("violates check constraint")) return new ApiError(422, "constraint_violation");
  return null;
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof ApiError) return errorResponse(e.status, e.code, e.fields, e.headers);
  if (e instanceof ZodError) {
    if (e.issues.some((i) => i.code === "unrecognized_keys")) return errorResponse(400, "unknown_field_rejected");
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[i.path.join(".") || "_"] = i.message;
    if (e.issues.some((i) => i.message === "mbi_not_allowed")) return errorResponse(400, "mbi_not_allowed", fields);
    return errorResponse(400, "validation_error", fields);
  }
  const mapped = mapDbError(e);
  if (mapped) return errorResponse(mapped.status, mapped.code, mapped.fields, mapped.headers);
  const requestId = randomUUID();
  // Log estructurado sin cuerpos de request ni datos de pacientes.
  console.error(
    JSON.stringify({
      level: "error",
      request_id: requestId,
      msg: "internal_error",
      err: e instanceof Error ? e.name : "unknown",
    }),
  );
  return NextResponse.json({ error: { code: "internal_error", request_id: requestId } }, { status: 500 });
}
