import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/guard";
import { ApiError } from "@/lib/errors";
import { parseId } from "@/lib/http";
import { appTimezone } from "@/lib/dates";
import { listProducers } from "@/lib/directory";
import { getReferral, listEvents, loadReasons } from "@/lib/referrals/service";
import { i18nFor } from "@/i18n/server";
import { formatDateTime, formatPhone, formatYmd } from "@/i18n/format";
import { StatusBadge } from "@/components/status-badge";
import { AssignControl } from "../../assign-control";
import type { MasterReferral, ProducerOption, UiText } from "../../types";

export const dynamic = "force-dynamic";

interface Detail extends MasterReferral {
  close_reason: { code: string; label_es: string; label_en: string } | null;
  close_reason_detail: string | null;
  plan_name: string | null;
  enrollment_date: string | null;
  effective_date: string | null;
  created_by: { id: string; full_name: string };
  assigned_by: { id: string; full_name: string } | null;
  assigned_at: string | null;
  closed_by: { id: string; full_name: string } | null;
  closed_at: string | null;
}

// Detalle completo con linea de tiempo de auditoria y reasignacion.
export default async function MaestroReferidoDetalle({ params }: { params: { id: string } }) {
  const s = await requirePageSession(["maestro"]);
  const { locale, d, tr } = i18nFor(s.locale);
  const tz = appTimezone();

  let r: Detail;
  let events: Awaited<ReturnType<typeof listEvents>>["items"];
  try {
    const id = parseId(params.id);
    r = (await getReferral(s, id)) as unknown as Detail;
    events = (await listEvents(s, id)).items;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [producers, reasons] = await Promise.all([listProducers("true"), loadReasons()]);

  const text: UiText = { m: d.master, status: d.status, producerType: d.producer_type, errors: d.errors };
  const m = d.master;
  const reasonLabel = (c: { label_es: string; label_en: string } | null | undefined) =>
    c ? (locale === "en" ? c.label_en : c.label_es) : null;
  const roleLabel = (role: string) =>
    role === "clinica" ? m.detail.role_clinica : role === "maestro" ? m.detail.role_maestro : m.detail.role_productor;

  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="flex flex-col gap-0.5 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:gap-4">
        <dt className="text-xs text-slate-500 sm:w-48 sm:shrink-0 sm:pt-0.5 sm:text-sm">{label}</dt>
        <dd className="text-base">{value}</dd>
      </div>
    ) : null;

  const mode = r.status === "nuevo" ? "assign" : ["asignado", "contactado", "sin_contacto"].includes(r.status) ? "reassign" : null;

  return (
    <div className="space-y-4">
      <Link href="/maestro/referidos" className="inline-flex min-h-touch items-center text-base font-medium text-brand-700">
        &larr; {m.detail.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{tr("master.detail.title", { ref_code: r.ref_code })}</h1>
        <StatusBadge status={r.status} label={d.status[r.status]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <dl className="rounded-xl border border-slate-200 bg-white px-4">
            {row(m.detail.patient, `${r.first_name} ${r.last_name}`)}
            {row(m.detail.phone, formatPhone(r.phone))}
            {row(m.detail.clinic, r.clinic.name)}
            {row(
              m.detail.producer,
              r.producer
                ? `${r.producer.full_name} (${d.producer_type[r.producer.producer_type]})`
                : null,
            )}
            {row(m.detail.producer_phone, r.producer?.phone ? formatPhone(r.producer.phone) : null)}
            {row(m.detail.attempts, r.status === "nuevo" ? null : String(r.contact_attempts))}
            {row(
              m.detail.registered_on,
              `${formatDateTime(r.created_at, locale, tz)} ${tr("master.detail.by", { actor: r.created_by.full_name })}`,
            )}
            {r.assigned_at &&
              row(
                m.detail.assigned_on,
                `${formatDateTime(r.assigned_at, locale, tz)}${
                  r.assigned_by ? ` ${tr("master.detail.by", { actor: r.assigned_by.full_name })}` : ""
                }`,
              )}
            {r.status === "inscrito" && (
              <>
                {row(m.detail.plan, r.plan_name)}
                {row(m.detail.enrollment_date, formatYmd(r.enrollment_date, locale))}
                {row(m.detail.effective_date, formatYmd(r.effective_date, locale))}
              </>
            )}
            {r.status === "no_inscrito" && row(m.detail.reason, reasonLabel(r.close_reason))}
            {row(m.detail.reason_detail, r.close_reason_detail)}
            {r.closed_at &&
              row(
                m.detail.closed_on,
                `${formatDateTime(r.closed_at, locale, tz)}${
                  r.closed_by ? ` ${tr("master.detail.by", { actor: r.closed_by.full_name })}` : ""
                }`,
              )}
          </dl>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold">
              {mode === "assign" ? m.detail.assign_title : m.detail.reassign_title}
            </h2>
            {mode ? (
              <AssignControl
                key={`${r.id}-${r.version}`}
                referralId={r.id}
                mode={mode}
                version={r.version}
                currentProducerId={r.producer?.id ?? null}
                producers={producers.items as unknown as ProducerOption[]}
                text={text}
                withNote={mode === "reassign"}
              />
            ) : (
              <p className="text-sm text-slate-600">{m.detail.closed_note}</p>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">{m.detail.timeline_title}</h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-600">{m.detail.timeline_empty}</p>
          ) : (
            <ol className="space-y-4 border-l-2 border-slate-200 pl-4">
              {events.map((e) => {
                const reason = e.close_reason_code ? reasonLabel(reasons.get(e.close_reason_code)) : null;
                return (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600" aria-hidden="true" />
                    <p className="text-sm font-medium">{m.events[e.event_type]}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(e.occurred_at, locale, tz)} &middot;{" "}
                      {tr("master.detail.by", { actor: `${e.actor.full_name} (${roleLabel(e.actor.role)})` })}
                    </p>
                    {e.to_producer && (
                      <p className="text-sm">{tr("master.detail.to_producer", { producer: e.to_producer.full_name })}</p>
                    )}
                    {e.from_producer && (
                      <p className="text-xs text-slate-500">
                        {tr("master.detail.from_producer", { producer: e.from_producer.full_name })}
                      </p>
                    )}
                    {reason && <p className="text-sm">{tr("master.detail.reason_label", { reason })}</p>}
                    {e.detail && <p className="text-sm text-slate-700">{e.detail}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
