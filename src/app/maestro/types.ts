import type { Dictionary } from "@/i18n/t";
import type { ReferralStatusValue } from "@/lib/referrals/transitions";

// Forma que la API entrega al maestro (ver serializeReferral, rama maestro / productor).
export interface MasterReferral {
  id: string;
  ref_number: number;
  ref_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: ReferralStatusValue;
  clinic: { id: string; name: string };
  created_at: string;
  version: number;
  contact_attempts: number;
  producer: { id: string; full_name: string; producer_type: "dependiente" | "independiente"; phone: string | null } | null;
  waiting_minutes?: number;
}

export interface ProducerOption {
  id: string;
  full_name: string;
  producer_type: "dependiente" | "independiente";
  open_load: number;
}

// Fila del directorio de productores (vista de administracion del maestro).
export interface ProducerRow {
  id: string;
  full_name: string;
  producer_type: "dependiente" | "independiente";
  npn: string | null;
  phone: string | null;
  active: boolean;
  user?: { id: string; email: string; active: boolean } | null;
}

// Fila del directorio de clinicas (vista de administracion del maestro).
export interface ClinicRow {
  id: string;
  name: string;
  active: boolean;
  users_count?: number;
  referrals_count?: number;
}

export interface ClinicUserRow {
  id: string;
  email: string;
  full_name: string;
  active: boolean;
  clinic_admin: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
}

export interface ProducerImportRow {
  row: number;
  status: "created" | "error";
  full_name?: string;
  email?: string;
  temp_password?: string;
  error_code?: string;
  error_fields?: Record<string, string>;
}

// Textos que los componentes cliente reciben ya resueltos en el servidor (idioma del usuario).
export interface UiText {
  m: Dictionary["master"];
  status: Dictionary["status"];
  producerType: Dictionary["producer_type"];
  errors: Record<string, string>;
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function waitLabel(minutes: number, w: Dictionary["master"]["wait"]): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return fmt(w.minutes, { n: m });
  if (m < 1440) return fmt(w.hours, { h: Math.floor(m / 60), m: m % 60 });
  return fmt(w.days, { d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60) });
}
