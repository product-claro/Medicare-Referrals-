import { isIP } from "node:net";

// IP del cliente para audit_log / sessions (columna inet: solo valores validos).
export function clientIp(req: Request): string | null {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = first || req.headers.get("x-real-ip")?.trim();
  return ip && isIP(ip) ? ip : null;
}
