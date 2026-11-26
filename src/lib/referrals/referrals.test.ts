import { describe, expect, it } from "vitest";
import { containsMbi } from "../mbi";
import { createdAtRange, isValidYmd, startOfDayInTz } from "../dates";
import {
  assignSchema,
  attemptSchema,
  closeSchema,
  createReferralSchema,
  listQuerySchema,
  normalizePhone,
} from "./schemas";
import { canTransition } from "./transitions";
import { refCode } from "./serialize";

describe("containsMbi", () => {
  it("detecta un MBI con guiones o espacios", () => {
    expect(containsMbi("1EG4-TE5-MK73")).toBe(true);
    expect(containsMbi("mi mbi es 1eg4 te5 mk73")).toBe(true);
  });
  it("no marca telefonos ni nombres normales", () => {
    expect(containsMbi("+13055550100")).toBe(false);
    expect(containsMbi("Maria Gonzalez")).toBe(false);
    expect(containsMbi(null)).toBe(false);
  });
});

describe("createReferralSchema", () => {
  const ok = { first_name: " Ana ", last_name: "Perez", phone: "(305) 555-0100" };
  it("normaliza telefono a E.164 y recorta nombres", () => {
    const r = createReferralSchema.parse(ok);
    expect(r.phone).toBe("+13055550100");
    expect(r.first_name).toBe("Ana");
  });
  it("rechaza llaves desconocidas como mbi / medicaid", () => {
    for (const k of ["mbi", "medicare_number", "medicaid"]) {
      const r = createReferralSchema.safeParse({ ...ok, [k]: "x" });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.code).toBe("unrecognized_keys");
    }
  });
  it("rechaza texto con patron MBI en el nombre", () => {
    const r = createReferralSchema.safeParse({ ...ok, last_name: "1EG4-TE5-MK73" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("mbi_not_allowed");
  });
  it("rechaza telefono invalido", () => {
    expect(createReferralSchema.safeParse({ ...ok, phone: "abc" }).success).toBe(false);
    expect(createReferralSchema.safeParse({ ...ok, phone: "12345" }).success).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("acepta formatos comunes", () => {
    expect(normalizePhone("3055550100")).toBe("+13055550100");
    expect(normalizePhone("1 305 555 0100")).toBe("+13055550100");
    expect(normalizePhone("+34 600 123 456")).toBe("+34600123456");
  });
});

describe("closeSchema", () => {
  it("inscrito exige plan y fechas coherentes", () => {
    expect(
      closeSchema.safeParse({
        outcome: "inscrito",
        plan_name: "Plan HMO Ejemplo A",
        enrollment_date: "2026-11-01",
        effective_date: "2027-01-01",
      }).success,
    ).toBe(true);
    expect(
      closeSchema.safeParse({
        outcome: "inscrito",
        plan_name: "Plan",
        enrollment_date: "2026-11-10",
        effective_date: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(closeSchema.safeParse({ outcome: "inscrito", plan_name: "Plan" }).success).toBe(false);
  });
  it("no_inscrito sin motivo pasa el schema (la API responde 422 close_reason_required)", () => {
    expect(closeSchema.safeParse({ outcome: "no_inscrito" }).success).toBe(true);
  });
  it("rechaza llaves desconocidas", () => {
    expect(closeSchema.safeParse({ outcome: "no_inscrito", reason_code: "otro", mbi: "x" }).success).toBe(false);
  });
});

describe("otros schemas", () => {
  it("assign exige uuid", () => {
    expect(assignSchema.safeParse({ producer_id: "no-uuid" }).success).toBe(false);
    expect(assignSchema.safeParse({ producer_id: "3f2b6f0e-1b7c-4c3a-9a55-0d6c2f4f9a11" }).success).toBe(true);
  });
  it("attempts exige expected_version", () => {
    expect(attemptSchema.safeParse({ outcome: "contactado" }).success).toBe(false);
    expect(attemptSchema.safeParse({ outcome: "contactado", expected_version: 1 }).success).toBe(true);
  });
  it("listado rechaza datos de paciente en la query", () => {
    expect(listQuerySchema.safeParse({ first_name: "Ana" }).success).toBe(false);
    expect(listQuerySchema.parse({}).page).toBe(1);
  });
});

describe("transiciones", () => {
  it("validas", () => {
    expect(canTransition("nuevo", "asignado")).toBe(true);
    expect(canTransition("asignado", "contactado")).toBe(true);
    expect(canTransition("sin_contacto", "inscrito")).toBe(true);
    expect(canTransition("contactado", "asignado")).toBe(true);
  });
  it("invalidas", () => {
    expect(canTransition("nuevo", "contactado")).toBe(false);
    expect(canTransition("nuevo", "inscrito")).toBe(false);
    expect(canTransition("inscrito", "asignado")).toBe(false);
    expect(canTransition("no_inscrito", "contactado")).toBe(false);
    expect(canTransition("asignado", "nuevo")).toBe(false);
  });
});

describe("fechas y formato", () => {
  it("valida YYYY-MM-DD", () => {
    expect(isValidYmd("2026-02-28")).toBe(true);
    expect(isValidYmd("2026-02-30")).toBe(false);
  });
  it("inicio de dia en America/New_York (EST = UTC-5, EDT = UTC-4)", () => {
    expect(startOfDayInTz("2026-01-15", "America/New_York").toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(startOfDayInTz("2026-07-15", "America/New_York").toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });
  it("'to' es inclusivo", () => {
    const r = createdAtRange("2026-01-15", "2026-01-15");
    expect(r.lt?.toISOString()).toBe("2026-01-16T05:00:00.000Z");
  });
  it("codigo corto", () => {
    expect(refCode(123)).toBe("R-000123");
  });
});
