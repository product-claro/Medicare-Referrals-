// Fechas YYYY-MM-DD y rangos por zona horaria de la app (APP_TIMEZONE, por defecto America/New_York).

export function appTimezone(): string {
  return process.env.APP_TIMEZONE || "America/New_York";
}

export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Columna tipo date (sin zona): 'YYYY-MM-DD' -> Date a medianoche UTC, lo que Prisma espera para @db.Date. */
export function ymdToDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function dateToYmd(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Instante en que empieza el dia 'YYYY-MM-DD' en la zona horaria dada. */
export function startOfDayInTz(ymd: string, tz = appTimezone()): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - tzOffsetMs(guess, tz);
  return new Date(guess - tzOffsetMs(first, tz));
}

function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Rango [gte, lt) para filtrar por created_at; 'to' es inclusivo (hasta el fin de ese dia). */
export function createdAtRange(from?: string, to?: string): { gte?: Date; lt?: Date } {
  const out: { gte?: Date; lt?: Date } = {};
  if (from) out.gte = startOfDayInTz(from);
  if (to) out.lt = startOfDayInTz(nextDay(to));
  return out;
}
