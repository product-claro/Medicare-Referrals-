import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/guard";
import { ApiError } from "@/lib/errors";
import { parseId } from "@/lib/http";
import { getReferral, listNotEnrolledReasons } from "@/lib/referrals/service";
import { isFinal } from "@/lib/referrals/transitions";
import { i18nFor } from "@/i18n/server";
import { formatDateTime, formatPhone, formatYmd } from "@/i18n/format";
import { StatusBadge } from "@/components/status-badge";
import { ReferralWork } from "./referral-work";
import type { ProducerReferral } from "../../types";

export const dynamic = "force-dynamic";

// Trabajar el referido. El alcance (producer_id propio) lo aplica scope.ts: uno ajeno responde 404.
export default async function ProductorReferidoDetalle({ params }: { params: { id: string } }) {
  const s = await requirePageSession(["productor"]);
  const { locale, d, tr } = i18nFor(s.locale);

  let r: ProducerReferral;
  try {
    r = (await getReferral(s, parseId(params.id))) as unknown as ProducerReferral;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const dt = d.producer.detail;
  const final = isFinal(r.status);
  const reasons = final
    ? []
    : (await listNotEnrolledReasons()).map((x) => ({
        code: x.code,
        label: locale === "en" ? x.label_en : x.label_es,
        requires_detail: x.requires_detail,
      }));
  const reasonLabel = r.close_reason ? (locale === "en" ? r.close_reason.label_en : r.close_reason.label_es) : null;

  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="flex flex-col gap-0.5 border-b border-slate-100 py-3 last:border-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-base">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <Link href="/productor" className="inline-flex min-h-touch items-center text-base font-medium text-brand-700">
        &larr; {dt.back}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{tr("producer.detail.title", { ref_code: r.ref_code })}</h1>
        <StatusBadge status={r.status} label={d.status[r.status]} />
      </div>

      <dl className="rounded-xl border border-slate-200 bg-white px-4">
        {row(dt.patient, `${r.first_name} ${r.last_name}`)}
        {row(
          dt.phone,
          <a href={`tel:${r.phone}`} className="inline-flex min-h-touch items-center font-semibold text-brand-700 underline">
            {formatPhone(r.phone)}
          </a>,
        )}
        {row(dt.clinic, r.clinic.name)}
        {row(dt.attempts, String(r.contact_attempts))}
        {r.assigned_at && row(dt.assigned_on, formatDateTime(r.assigned_at, locale))}
        {r.status === "inscrito" && (
          <>
            {row(dt.plan, r.plan_name)}
            {row(dt.enrollment_date, formatYmd(r.enrollment_date, locale))}
            {row(dt.effective_date, formatYmd(r.effective_date, locale))}
          </>
        )}
        {r.status === "no_inscrito" && row(dt.reason, reasonLabel)}
        {row(dt.reason_detail, r.close_reason_detail)}
        {r.closed_at && row(dt.closed_on, formatDateTime(r.closed_at, locale))}
      </dl>

      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{dt.medicare_note}</p>

      {final ? (
        <p className="text-sm text-slate-600">{d.producer.work.closed_note}</p>
      ) : (
        <ReferralWork
          key={`${r.id}-${r.version}`}
          referralId={r.id}
          version={r.version}
          reasons={reasons}
          text={{ w: d.producer.work, errors: d.errors }}
        />
      )}
    </div>
  );
}
