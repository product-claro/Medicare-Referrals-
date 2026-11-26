import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { listMasters } from "@/lib/directory";
import { MastersAdmin } from "./masters-admin";
import type { MasterRow, UiText } from "../types";

export const dynamic = "force-dynamic";

export default async function MaestroMaestros() {
  const s = await requirePageSession(["maestro"]);
  const { d } = i18nFor(s.locale);

  if (!s.superAdmin) {
    // Un maestro normal no tiene permiso para esta pantalla.
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{d.master.masters.title}</h1>
        <p className="text-sm text-slate-600">{d.errors.forbidden}</p>
      </div>
    );
  }

  const masters = await listMasters();
  const text: UiText = { m: d.master, status: d.status, producerType: d.producer_type, errors: d.errors };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{d.master.masters.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{d.master.masters.subtitle}</p>
      </div>
      <MastersAdmin initial={masters.items as unknown as MasterRow[]} text={text} />
    </div>
  );
}
