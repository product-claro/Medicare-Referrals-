import { randomBytes } from "node:crypto";

// Contrasena temporal de 16 caracteres; se muestra una sola vez y exige cambio en el primer ingreso.
export function generateTempPassword(): string {
  return randomBytes(12).toString("base64url");
}
