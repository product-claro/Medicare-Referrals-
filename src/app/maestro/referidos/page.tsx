import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { appTimezone, isValidYmd } from "@/lib/dates";
import { listClinics, listProducers } from "@/lib/directory";
import { listQuerySchema, uuid } from "@/lib/referrals/schemas";
import { listReferrals } from "@/lib/referrals/service";
import { ALL_STATUSES } from "@/lib/referrals/transitions";
import { ReferralsExplorer } from "./referrals-explorer";
import type { MasterReferral, ProducerOption, UiText } from "../types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SP = { status?: string; clinic_id?: string; producer_id?: string; from?: string; to?: string; page?: string };

// Todos los referidos de todas las clinicas. Los filtros son no sensibles (van en la URL);
// la busqueda por nombre/telefono se hace por POST desde el componente cliente.
export default async function MaestroReferidos(props: { searchParams: Promise<SP> }) {
  const searchParams = await props.searchParams;
  const s = await requirePageSession(["maestro"]);
  const { locale, d, tr } = await i18nFor(s.locale);

  const status = (ALL_STATUSES as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as (typeof ALL_STATUSES)[number])
    : undefined;
  const clinicId = uuid.safeParse(searchParams.clinic_id).success ? searchParams.clinic_id : undefined;
  const producerId = uuid.safeParse(searchParams.producer_id).success ? searchParams.producer_id : undefined;
  let from = searchParams.from && isValidYmd(searchParams.from) ? searchParams.from : undefined;
  let to = searchParams.to && isValidYmd(searchParams.to) ? searchParams.to : undefined;
  if (from && to && from > to) {
    from = undefined;
    to = undefined;
  }
  const parsedPage = Number(searchParams.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 10_000 ? parsedPage : 1;

  const q = listQuerySchema.parse({
    ...(status ? { status } : {}),
    ...(clinicId ? { clinic_id: clinicId } : {}),
    ...(producerId ? { producer_id: producerId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page,
    page_size: PAGE_SIZE,
  });

  const [res, clinics, producersAll, producersActive] = await Promise.all([
    listReferrals(s, q),
    listClinics("all"),
    listProducers("all"),
    listProducers("true"),
  ]);
  const pages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));

  const href = (p: number) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (clinicId) qs.set("clinic_id", clinicId);
    if (producerId) qs.set("producer_id", producerId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (p > 1) qs.set("page", String(p));
    const str = qs.toString();
    return `/maestro/referidos${str ? `?${str}` : ""}`;
  };

  const text: UiText = { m: d.master, common: d.common, status: d.status, producerType: d.producer_type, errors: d.errors };
  const r = d.master.referrals;
  const pageBtn = "flex min-h-touch items-center rounded-lg border border-slate-300 bg-white px-4";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{r.title}</h1>

      <form method="get" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={r.filters_title}>
        <h2 className="text-base font-semibold">{r.filters_title}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{r.status}</span>
            <select name="status" defaultValue={status ?? ""} className="input">
              <option value="">{r.all}</option>
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {d.status[st]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{r.clinic}</span>
            <select name="clinic_id" defaultValue={clinicId ?? ""} className="input">
              <option value="">{r.all}</option>
              {clinics.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{r.producer}</span>
            <select name="producer_id" defaultValue={producerId ?? ""} className="input">
              <option value="">{r.all}</option>
              {producersAll.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{r.from}</span>
            <input type="date" name="from" defaultValue={from ?? ""} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{r.to}</span>
            <input type="date" name="to" defaultValue={to ?? ""} className="input" />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className="btn-primary sm:w-auto sm:min-w-[8rem]">
            {r.apply}
          </button>
          <Link href="/maestro/referidos" className="flex min-h-touch items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-base">
            {r.clear}
          </Link>
        </div>
      </form>

      <ReferralsExplorer
        // Al cambiar de pagina / filtros se vuelve a montar y se descarta la busqueda en curso.
        key={href(page)}
        initial={res.items as unknown as MasterReferral[]}
        total={res.total}
        producers={producersActive.items as unknown as ProducerOption[]}
        text={text}
        locale={locale}
        timezone={appTimezone()}
      />

      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2 text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className={pageBtn}>
              {r.prev}
            </Link>
          ) : (
            <span className="min-h-touch w-24" />
          )}
          <span className="text-slate-600">{tr("master.referrals.page_of", { page, pages })}</span>
          {page < pages ? (
            <Link href={href(page + 1)} className={pageBtn}>
              {r.next}
            </Link>
          ) : (
            <span className="min-h-touch w-24" />
          )}
        </div>
      )}
    </div>
  );
}
