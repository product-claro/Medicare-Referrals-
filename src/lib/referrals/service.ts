import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../errors";
import { withActor } from "../with-actor";
import { createdAtRange, ymdToDate } from "../dates";
import type { AuthSession } from "../auth/guard";
import { referralInclude, scoped } from "./scope";
import { refCode, serializeReferral, type ReasonMap } from "./serialize";
import { isFinal, OPEN_STATUSES, type ReferralStatusValue } from "./transitions";
import type {
  CloseInput,
  CreateReferralInput,
  ListQuery,
  SearchInput,
} from "./schemas";

// Toda la logica de referidos vive aqui; los route handlers (y las server actions) solo validan y delegan.
// Las escrituras pasan por withActor (actor de auditoria) y los triggers de la base hacen cumplir las reglas fuertes.

type Tx = Prisma.TransactionClient;

const OPEN = [...OPEN_STATUSES];

export async function loadReasons(): Promise<ReasonMap> {
  const rows = await prisma.closeReason.findMany();
  return new Map(rows.map((r) => [r.code, { code: r.code, label_es: r.labelEs, label_en: r.labelEn }]));
}

async function fetchScoped(db: Tx | typeof prisma, s: AuthSession, id: string) {
  const row = await db.referral.findFirst({ where: scoped(s, { id }), include: referralInclude });
  if (!row) throw new ApiError(404, "not_found");
  return row;
}

// ---------------------------------------------------------------- crear (clinica)
export async function createReferral(s: AuthSession, input: CreateReferralInput) {
  if (s.role !== "clinica" || !s.clinicId) throw new ApiError(403, "forbidden");
  const clinicId = s.clinicId;
  const created = await withActor(
    s,
    (tx) =>
      tx.referral.create({
        // El trigger fija clinic_id / created_by / created_at desde el usuario; Prisma exige enviarlos.
        data: {
          clinicId,
          createdByUserId: s.userId,
          firstName: input.first_name,
          lastName: input.last_name,
          phone: input.phone,
        },
        select: { id: true, refNumber: true, status: true },
      }),
    // form_duration_ms queda en referral_events.data del evento 'creado' (criterio 1 medible).
    { data: input.form_duration_ms !== undefined ? { form_duration_ms: input.form_duration_ms } : {} },
  );
  const n = Number(created.refNumber);
  return { id: created.id, ref_number: n, ref_code: refCode(n), status: created.status };
}

// ---------------------------------------------------------------- listar
export async function listReferrals(s: AuthSession, q: ListQuery) {
  const range = createdAtRange(q.from, q.to);
  const where = scoped(s, {
    ...(q.status ? { status: q.status } : {}),
    ...(q.clinic_id ? { clinicId: q.clinic_id } : {}),
    ...(q.producer_id ? { producerId: q.producer_id } : {}),
    ...(range.gte || range.lt ? { createdAt: range } : {}),
  });
  const [total, rows, reasons] = await Promise.all([
    prisma.referral.count({ where }),
    prisma.referral.findMany({
      where,
      include: referralInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
    loadReasons(),
  ]);
  return {
    items: rows.map((r) => serializeReferral(r, s.role, reasons)),
    page: q.page,
    page_size: q.page_size,
    total,
  };
}

// Busqueda por nombre / apellido / telefono (maestro). Los criterios llegan en el body, nunca en la URL.
export async function searchReferrals(s: AuthSession, q: SearchInput) {
  const phoneDigits = q.phone?.replace(/\D/g, "");
  if (q.phone !== undefined && !phoneDigits) throw new ApiError(400, "validation_error", { phone: "invalid_phone" });
  const where = scoped(s, {
    ...(q.first_name ? { firstName: { contains: q.first_name, mode: "insensitive" as const } } : {}),
    ...(q.last_name ? { lastName: { contains: q.last_name, mode: "insensitive" as const } } : {}),
    ...(phoneDigits ? { phone: { contains: phoneDigits } } : {}),
  });
  const [total, rows, reasons] = await Promise.all([
    prisma.referral.count({ where }),
    prisma.referral.findMany({
      where,
      include: referralInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
    loadReasons(),
  ]);
  return {
    items: rows.map((r) => serializeReferral(r, s.role, reasons)),
    page: q.page,
    page_size: q.page_size,
    total,
  };
}

// Bandeja unica del maestro: todos los 'nuevo' de todas las clinicas, mas antiguos primero (criterio 3).
export async function listUnassigned(s: AuthSession) {
  const [rows, reasons] = await Promise.all([
    prisma.referral.findMany({
      where: scoped(s, { status: "nuevo" }),
      include: referralInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 500,
    }),
    loadReasons(),
  ]);
  const now = Date.now();
  return {
    items: rows.map((r) => ({
      ...serializeReferral(r, s.role, reasons),
      waiting_minutes: Math.max(0, Math.floor((now - r.createdAt.getTime()) / 60_000)),
    })),
    total: rows.length,
  };
}

// ---------------------------------------------------------------- detalle y auditoria
export async function getReferral(s: AuthSession, id: string) {
  const [row, reasons] = await Promise.all([fetchScoped(prisma, s, id), loadReasons()]);
  return serializeReferral(row, s.role, reasons);
}

export async function listEvents(s: AuthSession, id: string) {
  await fetchScoped(prisma, s, id); // 404 si no existe o esta fuera de alcance
  const events = await prisma.referralEvent.findMany({
    where: { referralId: id },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    include: {
      actor: { select: { id: true, fullName: true } },
      fromProducer: { select: { id: true, fullName: true } },
      toProducer: { select: { id: true, fullName: true } },
    },
  });
  return {
    items: events.map((e) => ({
      id: Number(e.id),
      event_type: e.eventType,
      actor: { id: e.actor.id, full_name: e.actor.fullName, role: e.actorRole },
      from_status: e.fromStatus,
      to_status: e.toStatus,
      from_producer: e.fromProducer && { id: e.fromProducer.id, full_name: e.fromProducer.fullName },
      to_producer: e.toProducer && { id: e.toProducer.id, full_name: e.toProducer.fullName },
      close_reason_code: e.closeReasonCode,
      detail: e.detail,
      data: e.data,
      occurred_at: e.occurredAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------- asignar (maestro)
async function requireActiveProducer(producerId: string) {
  const p = await prisma.producer.findUnique({ where: { id: producerId }, select: { active: true } });
  if (!p || !p.active) throw new ApiError(422, "producer_inactive_or_unknown");
}

export async function assignReferral(s: AuthSession, id: string, producerId: string) {
  await requireActiveProducer(producerId);
  const row = await withActor(s, async (tx) => {
    // Solo si sigue 'nuevo': si otro maestro lo asigno antes, 0 filas -> 409 already_assigned.
    const res = await tx.referral.updateMany({
      where: { id, status: "nuevo" },
      data: { status: "asignado", producerId, assignedByUserId: s.userId, assignedAt: new Date() },
    });
    if (res.count === 0) {
      const exists = await tx.referral.findUnique({ where: { id }, select: { id: true } });
      throw exists ? new ApiError(409, "already_assigned") : new ApiError(404, "not_found");
    }
    return fetchScoped(tx, s, id);
  });
  return serializeReferral(row, s.role, await loadReasons());
}

// Valida que el referido sea visible, este abierto y (si se pide) la version coincida.
async function guardOpen(tx: Tx, s: AuthSession, id: string, expectedVersion?: number) {
  const cur = await tx.referral.findFirst({
    where: scoped(s, { id }),
    select: { id: true, status: true, version: true, producerId: true },
  });
  if (!cur) throw new ApiError(404, "not_found");
  if (isFinal(cur.status as ReferralStatusValue)) throw new ApiError(409, "referral_already_closed");
  if (cur.status === "nuevo") throw new ApiError(409, "invalid_status_transition");
  if (expectedVersion !== undefined && cur.version !== expectedVersion) throw new ApiError(409, "stale_version");
  return cur;
}

export async function reassignReferral(
  s: AuthSession,
  id: string,
  input: { producer_id: string; note?: string; expected_version: number },
) {
  await requireActiveProducer(input.producer_id);
  const row = await withActor(
    s,
    async (tx) => {
      const cur = await guardOpen(tx, s, id, input.expected_version);
      if (cur.producerId === input.producer_id) throw new ApiError(422, "same_producer");
      const res = await tx.referral.updateMany({
        where: { id, version: cur.version, status: { in: OPEN } },
        data: { status: "asignado", producerId: input.producer_id, assignedByUserId: s.userId, assignedAt: new Date() },
      });
      if (res.count === 0) throw new ApiError(409, "stale_version");
      return fetchScoped(tx, s, id);
    },
    { note: input.note },
  );
  return serializeReferral(row, s.role, await loadReasons());
}

// ---------------------------------------------------------------- intentos de contacto
export async function registerAttempt(
  s: AuthSession,
  id: string,
  input: { outcome: "contactado" | "sin_contacto"; note?: string; expected_version: number },
) {
  const row = await withActor(
    s,
    async (tx) => {
      const cur = await guardOpen(tx, s, id, input.expected_version);
      const res = await tx.referral.updateMany({
        where: { id, version: cur.version, status: { in: OPEN } },
        data: { status: input.outcome, contactAttempts: { increment: 1 } },
      });
      if (res.count === 0) throw new ApiError(409, "stale_version");
      return fetchScoped(tx, s, id);
    },
    { note: input.note },
  );
  return serializeReferral(row, s.role, await loadReasons());
}

// ---------------------------------------------------------------- cierre (criterios 6 y 7)
export async function closeReferral(s: AuthSession, id: string, input: CloseInput) {
  let data: Prisma.ReferralUncheckedUpdateManyInput;
  let note: string | undefined;

  if (input.outcome === "inscrito") {
    data = {
      status: "inscrito",
      closeReasonCode: "inscrito_en_plan", // motivo automatico
      planName: input.plan_name,
      enrollmentDate: ymdToDate(input.enrollment_date),
      effectiveDate: ymdToDate(input.effective_date),
    };
  } else {
    if (!input.reason_code) throw new ApiError(422, "close_reason_required");
    const reason = await prisma.closeReason.findFirst({
      where: { code: input.reason_code, appliesTo: "no_inscrito", active: true },
    });
    if (!reason) throw new ApiError(422, "close_reason_required");
    if (reason.requiresDetail && !input.reason_detail) throw new ApiError(422, "close_reason_detail_required");
    data = {
      status: "no_inscrito",
      closeReasonCode: reason.code,
      closeReasonDetail: input.reason_detail ?? null,
    };
    note = input.reason_detail;
  }

  const row = await withActor(
    s,
    async (tx) => {
      const cur = await guardOpen(tx, s, id, input.expected_version);
      const res = await tx.referral.updateMany({
        where: { id, version: cur.version, status: { in: OPEN } },
        // El trigger vuelve a fijar closed_by / closed_at; la app los envia porque son parte del contrato.
        data: { ...data, closedByUserId: s.userId, closedAt: new Date() },
      });
      if (res.count === 0) throw new ApiError(409, "stale_version");
      return fetchScoped(tx, s, id);
    },
    { note },
  );
  return serializeReferral(row, s.role, await loadReasons());
}

// ---------------------------------------------------------------- vista del productor
const WORK_RANK: Record<string, number> = { asignado: 0, sin_contacto: 1, contactado: 2, inscrito: 3, no_inscrito: 3 };

// Referidos del productor (alcance por producer_id): activos primero (asignado, sin contacto, contactado),
// luego los cerrados; dentro de cada grupo, los asignados mas recientemente primero.
export async function listMyReferrals(s: AuthSession) {
  const [rows, reasons] = await Promise.all([
    prisma.referral.findMany({
      where: scoped(s),
      include: referralInclude,
      orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
      take: 500,
    }),
    loadReasons(),
  ]);
  const items = rows
    .map((r) => serializeReferral(r, s.role, reasons))
    .sort((a, b) => (WORK_RANK[a.status] ?? 9) - (WORK_RANK[b.status] ?? 9));
  return { items, total: items.length };
}

// Catalogo activo de motivos de no inscripcion (para el formulario de cierre).
export async function listNotEnrolledReasons() {
  const rows = await prisma.closeReason.findMany({
    where: { active: true, appliesTo: "no_inscrito" },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ code: r.code, label_es: r.labelEs, label_en: r.labelEn, requires_detail: r.requiresDetail }));
}
