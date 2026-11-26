import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleError } from "@/lib/errors";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Reintento del email generico opcional ("Tienes un nuevo referido asignado, entra a la app").
// El correo nunca lleva datos del paciente. Sin SMTP configurado no se envia nada: solo informa los pendientes.
// El envio SMTP real queda como pendiente del MVP (no hay dependencia de correo instalada).
export async function POST(req: Request) {
  try {
    if (!authorized(req)) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
    const pending = await prisma.notification.count({ where: { emailSentAt: null, emailError: null } });
    const smtp = Boolean(process.env.SMTP_HOST);
    return json({ smtp_configured: smtp, pending, sent: 0 });
  } catch (e) {
    return handleError(e);
  }
}
