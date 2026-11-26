import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { listClinics } from "@/lib/directory";
import { ClinicsAdmin } from "./clinics-admin";
import type { ClinicRow, UiText } from "../types";

export const dynamic = "force-dynamic";

export default async function MaestroClinicas() {
  const s = await requirePageSession(["maestro"]);
  const { d } = i18nFor(s.locale);
  const clinics = await listClinics("all");
  const text: UiText = { m: d.master, common: d.common, status: d.status, producerType: d.producer_type, errors: d.errors };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{d.master.clinics.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{d.master.clinics.subtitle}</p>
      </div>
      <ClinicsAdmin initial={clinics.items as unknown as ClinicRow[]} text={text} />
    </div>
  );
}
