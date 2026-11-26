// Espejo en TypeScript de contains_mbi() de Postgres: detecta un MBI (formato CMS de 11 caracteres)
// aunque venga con espacios o guiones. Misma expresion regular que la base (sin anclas).
const MBI_RE =
  /[1-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9][0-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9][0-9][AC-HJKMNP-RT-Y]{2}[0-9]{2}/;

export function containsMbi(t: string | null | undefined): boolean {
  if (t == null) return false;
  return MBI_RE.test(t.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
}
