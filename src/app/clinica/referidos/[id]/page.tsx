import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/guard";
import { ApiError } from "@/lib/errors";
import { parseId } from "@/lib/http";
import { getReferral } from "@/lib/referrals/service";
import { i18nFor } from "@/i18n/server";
import { formatDateTime, formatPhone, formatYmd } from "@/i18n/format";
import { StatusBadge } from "@/components/status-badge";
import type { ClinicReferral } from "../../types";

export const dynamic = "force-dynamic";

// Detalle de un referido propio. Si es de otra clinica o no existe: 404 (no se revela su existencia).
export default async function ReferidoDetalle({ params }: { params: { id: string } }) {
  const s = await requirePageSession(["clinica"]);
  const { locale, d, tr } = i18nFor(s.locale);

  let r: ClinicReferral;
  try {
    r = (await getReferral(s, parseId(params.id))) as unknown as ClinicReferral;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const reason = r.close_reason ? (locale === "en" ? r.close_reason.label_en : r.close_reason.label_es) : null;
  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div className="flex flex-col gap-0.5 border-b border-slate-100 py-3 last:border-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-base">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <Link href="/clinica/referidos" className="inline-flex min-h-touch items-center text-base font-medium text-brand-700">
        &larr; {d.clinic.detail.back}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{tr("clinic.detail.title", { ref_code: r.ref_code })}</h1>
        <StatusBadge status={r.status} label={d.status[r.status]} />
      </div>

      <dl className="rounded-xl border border-slate-200 bg-white px-4">
        {row(d.clinic.detail.patient, `${r.first_name} ${r.last_name}`)}
        {row(d.clinic.detail.phone, formatPhone(r.phone))}
        {row(d.clinic.detail.registered_on, formatDateTime(r.created_at, locale))}
        {r.status === "inscrito" && (
          <>
            {row(d.clinic.list.plan, r.plan_name)}
            {row(d.clinic.list.enrollment_date, formatYmd(r.enrollment_date, locale))}
            {row(d.clinic.list.effective_date, formatYmd(r.effective_date, locale))}
            {row(d.clinic.list.producer, r.producer_name)}
          </>
        )}
        {r.status === "no_inscrito" && row(d.clinic.list.reason, reason)}
        {r.closed_at && row(d.clinic.detail.closed_on, formatDateTime(r.closed_at, locale))}
      </dl>
    </div>
  );
}
