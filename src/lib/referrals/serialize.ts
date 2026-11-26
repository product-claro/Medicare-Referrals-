import { dateToYmd } from "../dates";
import type { Role } from "../auth/session";
import type { ReferralRow } from "./scope";

export interface CloseReasonInfo {
  code: string;
  label_es: string;
  label_en: string;
}
export type ReasonMap = Map<string, CloseReasonInfo>;

export function refCode(n: number | bigint): string {
  return `R-${String(n).padStart(6, "0")}`;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

// La API devuelve codigos y datos, nunca texto traducido. El detalle depende del rol:
//  - clinica: datos basicos + estado; si esta inscrito, plan, fechas y nombre del productor (criterio 7);
//    si no, el motivo del catalogo. Sin telefono del productor ni detalle libre de cierre.
//  - productor / maestro: detalle completo con auditoria (quien creo, asigno y cerro, y cuando).
export function serializeReferral(r: ReferralRow, role: Role, reasons: ReasonMap) {
  const refNumber = Number(r.refNumber);
  const base = {
    id: r.id,
    ref_number: refNumber,
    ref_code: refCode(refNumber),
    first_name: r.firstName,
    last_name: r.lastName,
    phone: r.phone,
    status: r.status,
    clinic: { id: r.clinic.id, name: r.clinic.name },
    created_at: r.createdAt.toISOString(),
  };
  const reason = r.closeReasonCode
    ? (reasons.get(r.closeReasonCode) ?? { code: r.closeReasonCode, label_es: r.closeReasonCode, label_en: r.closeReasonCode })
    : null;

  if (role === "clinica") {
    return {
      ...base,
      closed_at: iso(r.closedAt),
      ...(r.status === "inscrito"
        ? {
            plan_name: r.planName,
            enrollment_date: dateToYmd(r.enrollmentDate),
            effective_date: dateToYmd(r.effectiveDate),
            producer_name: r.producer?.fullName ?? null,
          }
        : {}),
      ...(r.status === "no_inscrito" ? { close_reason: reason } : {}),
    };
  }

  return {
    ...base,
    version: r.version,
    contact_attempts: r.contactAttempts,
    producer: r.producer
      ? {
          id: r.producer.id,
          full_name: r.producer.fullName,
          producer_type: r.producer.producerType,
          phone: r.producer.phone,
        }
      : null,
    close_reason: reason,
    close_reason_detail: r.closeReasonDetail,
    plan_name: r.planName,
    enrollment_date: dateToYmd(r.enrollmentDate),
    effective_date: dateToYmd(r.effectiveDate),
    created_by: { id: r.createdBy.id, full_name: r.createdBy.fullName },
    assigned_by: r.assignedBy ? { id: r.assignedBy.id, full_name: r.assignedBy.fullName } : null,
    assigned_at: iso(r.assignedAt),
    closed_by: r.closedBy ? { id: r.closedBy.id, full_name: r.closedBy.fullName } : null,
    closed_at: iso(r.closedAt),
    updated_at: r.updatedAt.toISOString(),
  };
}
