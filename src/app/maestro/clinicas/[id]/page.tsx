import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { getClinic, listClinicUsers } from "@/lib/directory";
import { ClinicUsersAdmin } from "./clinic-users-admin";
import type { ClinicUserRow, UiText } from "../../types";

export const dynamic = "force-dynamic";

export default async function ClinicDetail({ params }: { params: { id: string } }) {
  const s = await requirePageSession(["maestro"]);
  const { d } = i18nFor(s.locale);
  const [clinic, users] = await Promise.all([getClinic(params.id), listClinicUsers(params.id)]);
  const text: UiText = { m: d.master, common: d.common, status: d.status, producerType: d.producer_type, errors: d.errors };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/maestro/clinicas" className="text-sm text-brand-700 underline hover:no-underline">
          &larr; {d.master.clinics.back_to_list}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{clinic.name}</h1>
        <p className="mt-1 text-sm text-slate-600">{d.master.clinics.users_hint}</p>
      </div>
      <ClinicUsersAdmin clinicId={clinic.id} initial={users.items as unknown as ClinicUserRow[]} text={text} />
    </div>
  );
}
