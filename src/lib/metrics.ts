import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { createdAtRange } from "./dates";

// Definicion (a validar con Dave): llegados = referidos creados en el rango; cerrados = inscrito + no_inscrito;
// tasa de cierre = inscritos / llegados. La meta del 40% es solo una referencia (la linea base es 24%).
export const TARGET_CLOSE_RATE_PCT = 40;
export const BASELINE_CLOSE_RATE_PCT = 24;

interface Row {
  id: string;
  name: string;
  producer_type?: string;
  arrived: number;
  unassigned: number;
  in_progress: number;
  closed: number;
  enrolled: number;
  not_enrolled: number;
}

function withRate<T extends Row>(r: T) {
  return { ...r, close_rate_pct: r.arrived > 0 ? Math.round((1000 * r.enrolled) / r.arrived) / 10 : null };
}

const COUNTS = Prisma.sql`
  count(r.id)::int                                                                  AS arrived,
  count(r.id) FILTER (WHERE r.status = 'nuevo')::int                                AS unassigned,
  count(r.id) FILTER (WHERE r.status IN ('asignado','contactado','sin_contacto'))::int AS in_progress,
  count(r.id) FILTER (WHERE r.status IN ('inscrito','no_inscrito'))::int            AS closed,
  count(r.id) FILTER (WHERE r.status = 'inscrito')::int                             AS enrolled,
  count(r.id) FILTER (WHERE r.status = 'no_inscrito')::int                          AS not_enrolled`;

export async function getMetrics(q: { from?: string; to?: string }) {
  const range = createdAtRange(q.from, q.to);
  const dateFilter = Prisma.sql`${range.gte ? Prisma.sql` AND r.created_at >= ${range.gte}::timestamptz` : Prisma.empty}${
    range.lt ? Prisma.sql` AND r.created_at < ${range.lt}::timestamptz` : Prisma.empty
  }`;

  const [clinics, producers] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT c.id::text AS id, c.name AS name, ${COUNTS}
        FROM clinics c
        LEFT JOIN referrals r ON r.clinic_id = c.id ${dateFilter}
       GROUP BY c.id, c.name
       ORDER BY c.name`,
    // Por productor se cuenta el productor asignado actualmente (la historia esta en referral_events).
    prisma.$queryRaw<Row[]>`
      SELECT p.id::text AS id, p.full_name AS name, p.producer_type::text AS producer_type, ${COUNTS}
        FROM producers p
        LEFT JOIN referrals r ON r.producer_id = p.id ${dateFilter}
       GROUP BY p.id, p.full_name, p.producer_type
       ORDER BY p.full_name`,
  ]);

  // Totales sobre todos los referidos del rango (incluye los sin asignar, que no tienen productor).
  const [totals] = await prisma.$queryRaw<Row[]>`
    SELECT 'total' AS id, 'total' AS name, ${COUNTS}
      FROM referrals r
     WHERE true ${dateFilter}`;

  return {
    range: { from: q.from ?? null, to: q.to ?? null },
    target_close_rate_pct: TARGET_CLOSE_RATE_PCT,
    baseline_close_rate_pct: BASELINE_CLOSE_RATE_PCT,
    totals: totals ? withRate(totals) : null,
    by_clinic: clinics.map((r) => {
      const { id, name, ...rest } = withRate(r);
      return { clinic_id: id, clinic_name: name, ...rest };
    }),
    by_producer: producers.map((r) => {
      const { id, name, ...rest } = withRate(r);
      return { producer_id: id, producer_name: name, ...rest };
    }),
  };
}
