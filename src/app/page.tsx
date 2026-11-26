import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guard";
import { ROLE_HOME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Redireccion segun rol: clinica -> /clinica, maestro -> /maestro, productor -> /productor.
export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  redirect(s.mustChangePassword ? "/cambiar-clave" : ROLE_HOME[s.role]);
}
