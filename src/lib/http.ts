import { NextResponse } from "next/server";
import { ApiError } from "./errors";

// Las respuestas con datos de pacientes nunca se cachean.
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "validation_error");
  }
}

// Parametros de query como objeto plano (el schema zod .strict() rechaza llaves desconocidas).
export function queryObject(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un id mal formado se trata igual que uno inexistente: 404.
export function parseId(id: string): string {
  if (!UUID_RE.test(id)) throw new ApiError(404, "not_found");
  return id.toLowerCase();
}
