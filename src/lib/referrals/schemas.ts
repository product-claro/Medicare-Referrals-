import { z } from "zod";
import { containsMbi } from "../mbi";
import { isValidYmd } from "../dates";
import { MIN_PASSWORD_LENGTH } from "../auth/password";
import { ALL_STATUSES } from "./transitions";

// Todos los schemas son .strict(): llaves desconocidas (mbi, medicare_number, medicaid...) -> 400 unknown_field_rejected.

export const MBI_MESSAGE = "mbi_not_allowed"; // el texto visible sale del diccionario: errors.mbi_not_allowed

export const noMbi = (v: string) => !containsMbi(v);

export const freeText = (min: number, max: number) =>
  z.string().trim().min(min).max(max).refine(noMbi, { message: MBI_MESSAGE });

// Contrasena inicial opcional al crear un usuario: si no se manda, se genera una temporal.
// De cualquier forma, el usuario debe cambiarla al entrar (must_change_password siempre queda true).
export const initialPassword = z
  .string()
  .max(200)
  .refine((v) => v.length >= MIN_PASSWORD_LENGTH, { message: "password_too_short" })
  .optional();

export const uuid = z.string().uuid();

export const ymd = z.string().refine(isValidYmd, { message: "invalid_date" });

// Telefono a E.164. Acepta "+13055550100", "(305) 555-0100", "1 305 555 0100"; 10 digitos se asumen +1.
export function normalizePhone(raw: string): string | null {
  const s = raw.trim();
  if (!/^[+\d\s().-]+$/.test(s)) return null;
  const digits = s.replace(/\D/g, "");
  let e164: string;
  if (s.startsWith("+")) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else return null;
  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
}

export const phone = z
  .string()
  .max(40)
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_phone" });
      return z.NEVER;
    }
    return n;
  });

const status = z.enum(ALL_STATUSES);

// ---------- Crear (clinica) ----------
export const createReferralSchema = z
  .object({
    first_name: freeText(1, 80),
    last_name: freeText(1, 80),
    phone,
    form_duration_ms: z.number().int().min(0).max(86_400_000).optional(),
  })
  .strict();
export type CreateReferralInput = z.infer<typeof createReferralSchema>;

// ---------- Listar / buscar ----------
const pagination = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
};

export const listQuerySchema = z
  .object({
    status: status.optional(),
    clinic_id: uuid.optional(),
    producer_id: uuid.optional(),
    from: ymd.optional(),
    to: ymd.optional(),
    ...pagination,
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "invalid_range", path: ["to"] });
export type ListQuery = z.infer<typeof listQuerySchema>;

const searchText = z.string().trim().min(1).max(80);
export const searchSchema = z
  .object({
    first_name: searchText.optional(),
    last_name: searchText.optional(),
    phone: z.string().trim().min(3).max(40).optional(),
    ...pagination,
  })
  .strict()
  .refine((q) => q.first_name || q.last_name || q.phone, { message: "search_criteria_required", path: ["_"] });
export type SearchInput = z.infer<typeof searchSchema>;

// ---------- Asignar / reasignar (maestro) ----------
export const assignSchema = z.object({ producer_id: uuid }).strict();

export const reassignSchema = z
  .object({
    producer_id: uuid,
    note: freeText(1, 500).optional(),
    expected_version: z.number().int().min(1),
  })
  .strict();

// ---------- Intentos de contacto (productor asignado o maestro) ----------
export const attemptSchema = z
  .object({
    outcome: z.enum(["contactado", "sin_contacto"]),
    note: freeText(1, 500).optional(),
    expected_version: z.number().int().min(1),
  })
  .strict();

// ---------- Cierre ----------
const inscritoSchema = z
  .object({
    outcome: z.literal("inscrito"),
    plan_name: freeText(1, 200),
    enrollment_date: ymd,
    effective_date: ymd,
    expected_version: z.number().int().min(1).optional(),
  })
  .strict();

const noInscritoSchema = z
  .object({
    outcome: z.literal("no_inscrito"),
    // Opcional a nivel de schema: sin motivo la API responde 422 close_reason_required (no 400).
    reason_code: z
      .string()
      .regex(/^[a-z_]{2,40}$/)
      .optional(),
    reason_detail: freeText(1, 500).optional(),
    expected_version: z.number().int().min(1).optional(),
  })
  .strict();

export const closeSchema = z
  .discriminatedUnion("outcome", [inscritoSchema, noInscritoSchema])
  .superRefine((v, ctx) => {
    if (v.outcome === "inscrito" && v.effective_date < v.enrollment_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "effective_before_enrollment", path: ["effective_date"] });
    }
  });
export type CloseInput = z.infer<typeof closeSchema>;

// ---------- Metricas ----------
export const metricsQuerySchema = z
  .object({ from: ymd.optional(), to: ymd.optional() })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "invalid_range", path: ["to"] });

// ---------- Productores ----------
export const producerType = z.enum(["dependiente", "independiente"]);
const npn = z.string().regex(/^[0-9]{1,10}$/, "invalid_npn");
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "invalid_email");
const personName = z.string().trim().min(2).max(160).refine(noMbi, { message: MBI_MESSAGE });

export const createProducerSchema = z
  .object({
    full_name: personName,
    producer_type: producerType,
    npn: npn.optional(),
    phone: phone.optional(),
    email: email.optional(), // si viene, se crea tambien su usuario de acceso
    initial_password: initialPassword,
  })
  .strict();

export const updateProducerSchema = z
  .object({
    full_name: personName.optional(),
    producer_type: producerType.optional(),
    npn: npn.nullable().optional(),
    phone: phone.nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "empty_update", path: ["_"] });

export const activeFilterQuery = (def: "true" | "all") =>
  z.object({ active: z.enum(["true", "false", "all"]).default(def) }).strict();

// ---------- Clinicas ----------
const clinicName = z.string().trim().min(2).max(200);

export const createClinicSchema = z
  .object({ name: clinicName, email, full_name: personName, initial_password: initialPassword })
  .strict();

export const updateClinicSchema = z
  .object({ name: clinicName.optional(), active: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "empty_update", path: ["_"] });

// ---------- Usuarios de una clinica (personal con login propio) ----------
export const createClinicUserSchema = z
  .object({ full_name: personName, email, clinic_admin: z.boolean().optional(), initial_password: initialPassword })
  .strict();

export const updateUserSchema = z
  .object({
    active: z.boolean().optional(),
    clinic_admin: z.boolean().optional(),
    super_admin: z.boolean().optional(),
    new_password: z.string().max(200).refine((v) => v.length >= MIN_PASSWORD_LENGTH, { message: "password_too_short" }).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "empty_update", path: ["_"] });

// ---------- Cuentas de maestro (solo las crea/administra un administrador maestro) ----------
export const createMasterSchema = z
  .object({ full_name: personName, email, super_admin: z.boolean().optional(), initial_password: initialPassword })
  .strict();
