import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { listMyReferrals } from "@/lib/referrals/service";
import { isFinal } from "@/lib/referrals/transitions";
import { i18nFor } from "@/i18n/server";
import { formatDateTime, formatPhone } from "@/i18n/format";
import { StatusBadge } from "@/components/status-badge";
import type { ProducerReferral } from "./types";

export const dynamic = "force-dynamic";

// Mis referidos asignados: activos primero (asignado, sin contacto, contactado), luego los cerrados.
export default async function ProductorHome() {
  const s = await requirePageSession(["productor"]);
  const { locale, d, tr } = await i18nFor(s.locale);
  const res = await listMyReferrals(s);
  const items = res.items as unknown as ProducerReferral[];
  const active = items.filter((r) => !isFinal(r.status));
  const closed = items.filter((r) => isFinal(r.status));
  const l = d.producer.list;

  const card = (r: ProducerReferral) => (
    <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{r.ref_code}</p>
          <p className="truncate text-lg font-semibold">
            {r.first_name} {r.last_name}
          </p>
          <p className="truncate text-sm text-slate-600">
            {l.clinic}: {r.clinic.name}
          </p>
        </div>
        <StatusBadge status={r.status} label={d.status[r.status]} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {l.attempts}: {r.contact_attempts}
        {r.assigned_at ? ` · ${l.assigned_on}: ${formatDateTime(r.assigned_at, locale)}` : ""}
      </p>
      <div className="mt-3 flex gap-2">
        {!isFinal(r.status) && (
          <a
            href={`tel:${r.phone}`}
            className="flex min-h-touch flex-1 items-center justify-center rounded-lg border border-brand-600 text-base font-semibold text-brand-700"
          >
            {l.call} {formatPhone(r.phone)}
          </a>
        )}
        <Link
          href={`/productor/referidos/${r.id}`}
          className="flex min-h-touch flex-1 items-center justify-center rounded-lg bg-brand-600 text-base font-semibold text-white hover:bg-brand-700"
        >
          {l.open}
        </Link>
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">{l.title}</h1>
          <p className="text-sm text-slate-500">{tr("producer.list.total", { count: res.total })}</p>
        </div>
        <p className="text-sm text-slate-600">{l.subtitle}</p>
      </div>

      {items.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">{l.empty}</p>}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{l.active_title}</h2>
          <ul className="space-y-3">{active.map(card)}</ul>
        </section>
      )}
      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{l.closed_title}</h2>
          <ul className="space-y-3">{closed.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
