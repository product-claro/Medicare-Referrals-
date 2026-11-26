// Reglas de estado (espejo de referrals_before_write en la base; la base es la que manda).
export type ReferralStatusValue = "nuevo" | "asignado" | "contactado" | "sin_contacto" | "inscrito" | "no_inscrito";

export const ALL_STATUSES = ["nuevo", "asignado", "contactado", "sin_contacto", "inscrito", "no_inscrito"] as const;
export const OPEN_STATUSES = ["asignado", "contactado", "sin_contacto"] as const;
export const FINAL_STATUSES = ["inscrito", "no_inscrito"] as const;

export function isFinal(s: ReferralStatusValue): boolean {
  return (FINAL_STATUSES as readonly string[]).includes(s);
}

export function isOpen(s: ReferralStatusValue): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(s);
}

// nuevo -> asignado; asignado / contactado / sin_contacto -> cualquiera de los abiertos o finales.
// inscrito y no_inscrito son finales e inmutables en el MVP.
export function canTransition(from: ReferralStatusValue, to: ReferralStatusValue): boolean {
  if (from === "nuevo") return to === "asignado";
  if (isOpen(from)) return to !== "nuevo";
  return false;
}
