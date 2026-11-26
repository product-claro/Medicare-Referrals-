import es from "./dictionaries/es.json";

// es.json es la fuente de verdad: una llave mal escrita da error de TypeScript.
export type Dictionary = typeof es;

type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type DictKey = Paths<Dictionary>;

function lookup(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

// Interpolacion {var} con respaldo a es si falta la llave.
export function t(dict: Dictionary, key: DictKey, vars?: Record<string, string | number>): string {
  const raw = lookup(dict, key) ?? lookup(es, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}
