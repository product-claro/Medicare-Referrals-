import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { formatDateTime, formatPhone, formatYmd } from "@/i18n/format";
import { listQuerySchema } from "@/lib/referrals/schemas";
import { listReferrals } from "@/lib/referrals/service";
import { ALL_STATUSES } from "@/lib/referrals/transitions";
import { StatusBadge } from "@/components/status-badge";
import type { ClinicReferral } from "../types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// Criterio UI 3: vista de resultado para la clinica. Solo ve los referidos de su clinica (scope.ts).
export default async function ReferidosPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const s = await requirePageSession(["clinica"]);
  const { locale, d, tr } = i18nFor(s.locale);

  const status = (ALL_STATUSES as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as (typeof ALL_STATUSES)[number])
    : undefined;
  const parsedPage = Number(searchParams.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 10_000 ? parsedPage : 1;

  const q = listQuerySchema.parse({ ...(status ? { status } : {}), page, page_size: PAGE_SIZE });
  const res = await listReferrals(s, q);
  const items = res.items as unknown as ClinicReferral[];
  const pages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));

  const href = (st: string | undefined, p = 1) => {
    const qs = new URLSearchParams();
    if (st) qs.set("status", st);
    if (p > 1) qs.set("page", String(p));
    const str = qs.toString();
    return `/clinica/referidos${str ? `?${str}` : ""}`;
  };
  const reasonLabel = (r: ClinicReferral) =>
    r.close_reason ? (locale === "en" ? r.close_reason.label_en : r.close_reason.label_es) : null;

  const chip = (active: boolean) =>
    `flex min-h-[2.75rem] shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
      active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{d.clinic.list.title}</h1>
        <p className="text-sm text-slate-500">{tr("clinic.list.total", { count: res.total })}</p>
      </div>

      <nav aria-label={d.clinic.list.filter_label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={href(undefined)} className={chip(!status)} aria-current={!status ? "true" : undefined}>
          {d.clinic.list.filter_all}
        </Link>
        {ALL_STATUSES.map((st) => (
          <Link key={st} href={href(st)} className={chip(status === st)} aria-current={status === st ? "true" : undefined}>
            {d.status[st]}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
          {status ? d.clinic.list.empty_filtered : d.clinic.list.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                href={`/clinica/referidos/${r.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="text-sm text-slate-600">{formatPhone(r.phone)}</p>
                  </div>
                  <StatusBadge status={r.status} label={d.status[r.status]} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {r.ref_code} · {d.clinic.list.registered} {formatDateTime(r.created_at, locale)}
                </p>

                {r.status === "inscrito" && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-sm">
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">{d.clinic.list.plan}</dt>
                      <dd className="font-medium">{r.plan_name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">{d.clinic.list.enrollment_date}</dt>
                      <dd>{formatYmd(r.enrollment_date, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">{d.clinic.list.effective_date}</dt>
                      <dd>{formatYmd(r.effective_date, locale)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">{d.clinic.list.producer}</dt>
                      <dd>{r.producer_name}</dd>
                    </div>
                  </dl>
                )}

                {r.status === "no_inscrito" && reasonLabel(r) && (
                  <p className="mt-3 border-t border-slate-100 pt-3 text-sm">
                    <span className="text-xs text-slate-500">{d.clinic.list.reason}: </span>
                    {reasonLabel(r)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2 text-sm">
          {page > 1 ? (
            <Link href={href(status, page - 1)} className="flex min-h-touch items-center rounded-lg border border-slate-300 bg-white px-4">
              {d.clinic.list.prev}
            </Link>
          ) : (
            <span className="min-h-touch w-24" />
          )}
          <span className="text-slate-600">{tr("clinic.list.page_of", { page, pages })}</span>
          {page < pages ? (
            <Link href={href(status, page + 1)} className="flex min-h-touch items-center rounded-lg border border-slate-300 bg-white px-4">
              {d.clinic.list.next}
            </Link>
          ) : (
            <span className="min-h-touch w-24" />
          )}
        </div>
      )}
    </div>
  );
}
