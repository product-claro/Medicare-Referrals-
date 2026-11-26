import { NextResponse, type NextRequest } from "next/server";
import {
  ROLE_HOME,
  SESSION_COOKIE,
  appUrlOrigin,
  sessionCookieOptions,
  sessionTtlSeconds,
  signSession,
  verifySessionToken,
  type Role,
} from "@/lib/auth/session";

// Primera barrera: sin tocar la base. La autorizacion real es requireSession() en cada handler / pagina.

const PAGE_PREFIX_ROLE: Array<[string, Role]> = [
  ["/clinica", "clinica"],
  ["/maestro", "maestro"],
  ["/productor", "productor"],
];

const PUBLIC_PAGES = new Set(["/login"]);
const PUBLIC_API = new Set(["/api/auth/login", "/api/health", "/api/me/locale"]);
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function json(status: number, code: string) {
  return NextResponse.json({ error: { code } }, { status });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isCron = pathname.startsWith("/api/cron/"); // se autentica con Bearer CRON_SECRET en el handler

  // CSRF: Origin debe coincidir con APP_URL y el cuerpo, si lo hay, debe ser JSON.
  if (isApi && MUTATING.has(req.method) && !isCron) {
    const allowed = appUrlOrigin();
    const origin = req.headers.get("origin");
    if (!allowed || origin !== allowed) return json(403, "origin_not_allowed");
    const ct = req.headers.get("content-type");
    if (ct && !ct.toLowerCase().startsWith("application/json")) return json(415, "unsupported_media_type");
  }

  if (isCron || PUBLIC_API.has(pathname) || PUBLIC_PAGES.has(pathname)) return NextResponse.next();

  const payload = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) {
    if (isApi) return json(401, "unauthorized");
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const res = NextResponse.redirect(url);
    if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // Control grueso por prefijo: rol equivocado -> inicio de su rol.
  if (!isApi) {
    const match = PAGE_PREFIX_ROLE.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
    if (match && match[1] !== payload.role) {
      const url = req.nextUrl.clone();
      url.pathname = ROLE_HOME[payload.role];
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();

  // Ventana deslizante de la cookie: se renueva cuando queda menos de la mitad.
  const ttl = sessionTtlSeconds(payload.role);
  if (payload.exp - Date.now() / 1000 < ttl / 2) {
    const fresh = await signSession({ ...payload, exp: Math.floor(Date.now() / 1000) + ttl });
    res.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions(ttl));
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
