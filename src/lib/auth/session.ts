// Cookie de sesion firmada. Solo Web Crypto: funciona igual en middleware (edge) y en route handlers.
// Formato: base64url(payload JSON) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET)).

export type Role = "clinica" | "maestro" | "productor";

export const SESSION_COOKIE = "rf_session";

export const ROLE_HOME: Record<Role, string> = {
  clinica: "/clinica",
  maestro: "/maestro",
  productor: "/productor",
};

// Duracion deslizante: 30 dias para clinica, 12 horas para maestro y productor.
export function sessionTtlSeconds(role: Role): number {
  return role === "clinica" ? 30 * 24 * 3600 : 12 * 3600;
}

export interface SessionPayload {
  sid: string; // sessions.id
  uid: string; // users.id
  role: Role;
  cid?: string; // clinic_id (rol clinica)
  pid?: string; // producer_id (rol productor)
  exp: number; // epoch en segundos
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function secrets(): { current: string; previous?: string } {
  const current = process.env.SESSION_SECRET ?? "";
  if (current.length < 32) {
    throw new Error("SESSION_SECRET must be set (32+ chars)");
  }
  const previous = process.env.SESSION_SECRET_PREVIOUS;
  return { current, previous: previous && previous.length >= 32 ? previous : undefined };
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secrets().current, "sign");
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${toB64Url(sig)}`;
}

const ROLES: readonly string[] = ["clinica", "maestro", "productor"];

// Devuelve el payload si la firma es valida y no ha expirado; si no, null. No toca la base.
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const sig = fromB64Url(token.slice(dot + 1));
  if (!sig) return null;

  const { current, previous } = secrets();
  let valid = false;
  for (const s of previous ? [current, previous] : [current]) {
    const key = await hmacKey(s, "verify");
    // crypto.subtle.verify compara en tiempo constante.
    if (await crypto.subtle.verify("HMAC", key, sig as BufferSource, enc.encode(body) as BufferSource)) {
      valid = true;
      break;
    }
  }
  if (!valid) return null;

  const raw = fromB64Url(body);
  if (!raw) return null;
  try {
    const p = JSON.parse(dec.decode(raw)) as Partial<SessionPayload>;
    if (
      typeof p.sid !== "string" ||
      typeof p.uid !== "string" ||
      typeof p.role !== "string" ||
      !ROLES.includes(p.role) ||
      typeof p.exp !== "number" ||
      p.exp * 1000 <= Date.now()
    ) {
      return null;
    }
    return p as SessionPayload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function appUrlOrigin(): string | null {
  try {
    return new URL(process.env.APP_URL ?? "").origin;
  } catch {
    return null;
  }
}
