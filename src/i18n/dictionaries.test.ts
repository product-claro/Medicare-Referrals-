import { describe, expect, it } from "vitest";
import es from "./dictionaries/es.json";
import en from "./dictionaries/en.json";

function flatten(o: unknown, p = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === "string") out[p + k] = v;
    else Object.assign(out, flatten(v, `${p}${k}.`));
  }
  return out;
}
const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("diccionarios", () => {
  const a = flatten(es);
  const b = flatten(en);
  it("en tiene las mismas llaves que es", () => {
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
  });
  it("mismos placeholders", () => {
    for (const k of Object.keys(a)) expect(ph(b[k] ?? "")).toBe(ph(a[k]!));
  });
});
