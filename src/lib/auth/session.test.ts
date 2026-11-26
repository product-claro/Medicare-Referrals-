import { beforeAll, describe, expect, it } from "vitest";
import { signSession, verifySessionToken, type SessionPayload } from "./session";
import { hashPassword, verifyPassword } from "./password";

const base = (exp: number): SessionPayload => ({ sid: "s1", uid: "u1", role: "clinica", cid: "c1", exp });
const future = () => Math.floor(Date.now() / 1000) + 3600;

beforeAll(() => {
  process.env.SESSION_SECRET = "a".repeat(48);
  delete process.env.SESSION_SECRET_PREVIOUS;
});

describe("cookie de sesion", () => {
  it("acepta una cookie valida", async () => {
    const t = await signSession(base(future()));
    expect((await verifySessionToken(t))?.uid).toBe("u1");
  });
  it("rechaza payload manipulado", async () => {
    const t = await signSession(base(future()));
    const forged = Buffer.from(JSON.stringify({ ...base(future()), role: "maestro" })).toString("base64url");
    expect(await verifySessionToken(`${forged}.${t.split(".")[1]}`)).toBeNull();
  });
  it("rechaza cookie expirada", async () => {
    const t = await signSession(base(Math.floor(Date.now() / 1000) - 10));
    expect(await verifySessionToken(t)).toBeNull();
  });
  it("rechaza basura y vacio", async () => {
    expect(await verifySessionToken("x.y.z")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });
  it("acepta SESSION_SECRET_PREVIOUS solo para verificar", async () => {
    const t = await signSession(base(future()));
    process.env.SESSION_SECRET_PREVIOUS = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "b".repeat(48);
    expect(await verifySessionToken(t)).not.toBeNull();
    delete process.env.SESSION_SECRET_PREVIOUS;
    expect(await verifySessionToken(t)).toBeNull();
  });
});

describe("password", () => {
  it("hash y verificacion", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});
