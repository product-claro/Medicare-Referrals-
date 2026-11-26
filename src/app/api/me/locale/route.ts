import { z } from "zod";
import { handleError } from "@/lib/errors";
import { json, readJson } from "@/lib/http";
import { getSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({ locale: z.enum(["es", "en"]) }).strict();

// Publico (cookie lang) y, si hay sesion, tambien users.locale para que los avisos salgan en ese idioma.
export async function PUT(req: Request) {
  try {
    const { locale } = schema.parse(await readJson(req));
    const s = await getSession();
    if (s) await prisma.user.update({ where: { id: s.userId }, data: { locale } });
    const res = json({ locale });
    res.cookies.set("lang", locale, { path: "/", maxAge: 31_536_000, sameSite: "lax", httpOnly: false });
    return res;
  } catch (e) {
    return handleError(e);
  }
}
