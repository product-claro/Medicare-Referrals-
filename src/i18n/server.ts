import { cookies, headers } from "next/headers";
import es from "./dictionaries/es.json";
import en from "./dictionaries/en.json";
import { defaultLocale, isLocale, type Locale } from "./config";
import { t, type Dictionary } from "./t";

// Solo servidor. Orden: cookie lang -> users.locale (si hay sesion) -> Accept-Language -> es.
const dictionaries: Record<Locale, Dictionary> = { es, en };

export async function getLocale(sessionLocale?: Locale | null): Promise<Locale> {
  const c = (await cookies()).get("lang")?.value;
  if (isLocale(c)) return c;
  if (sessionLocale && isLocale(sessionLocale)) return sessionLocale;
  const al = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  for (const part of al.split(",")) {
    const tag = part.trim().slice(0, 2);
    if (isLocale(tag)) return tag;
  }
  return defaultLocale;
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Helper listo para usar en componentes de servidor: const { locale, d, tr } = await i18nFor(...) */
export async function i18nFor(sessionLocale?: Locale | null) {
  const locale = await getLocale(sessionLocale);
  const d = getDictionary(locale);
  return { locale, d, tr: (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t(d, key, vars) };
}
