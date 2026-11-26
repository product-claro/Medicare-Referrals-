import type { Locale } from "./config";

// Telefono E.164 (+13055550100) -> +1 (305) 555-0100. Otros formatos se devuelven tal cual.
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}

// Columnas tipo date (YYYY-MM-DD): se muestran sin conversion de zona horaria.
export function formatYmd(ymd: string | null | undefined, locale: Locale): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

// Instantes (timestamptz): zona APP_TIMEZONE.
export function formatDateTime(iso: string, locale: Locale, tz = process.env.APP_TIMEZONE || "America/New_York"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(iso));
}
