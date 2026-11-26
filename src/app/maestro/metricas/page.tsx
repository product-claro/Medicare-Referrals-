import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { isValidYmd } from "@/lib/dates";
import { getMetrics } from "@/lib/metrics";
import type { Dictionary } from "@/i18n/t";

export const dynamic = "force-dynamic";

type MetricsData = Awaited<ReturnType<typeof getMetrics>>;
type Counts = Pick<
  NonNullable<MetricsData["totals"]>,
  "arrived" | "unassigned" | "in_progress" | "closed" | "enrolled" | "not_enrolled" | "close_rate_pct"
>;

// Indicador visual de la tasa de cierre con la meta como linea de referencia (no valida ni bloquea nada).
function RateBar({ pct, target, mm }: { pct: number | null; target: number; mm: Dictionary["master"]["metrics"] }) {
  if (pct === null) return <span className="text-slate-400">{mm.no_rate}</span>;
  const reached = pct >= target;
  return (
    <div className="min-w-[9rem]">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums">{pct.toFixed(1)}%</span>
        <span className={`text-xs ${reached ? "text-green-700" : "text-amber-700"}`}>
          {reached ? mm.reached : mm.below}
        </span>
      </div>
      <div
        className="relative mt-1 h-2 rounded-full bg-slate-200"
        role="img"
        aria-label={`${mm.close_rate}: ${pct.toFixed(1)}%. ${mm.target.replace("{target}", String(target))}`}
      >
        <div
          className={`h-2 rounded-full ${reached ? "bg-green-600" : "bg-amber-500"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        <div className="absolute -top-0.5 h-3 w-0.5 bg-slate-900" style={{ left: `${target}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const thNum = `${th} text-right`;
const td = "px-3 py-2 text-sm";
const tdNum = `${td} text-right tabular-nums`;

export default async function MaestroMetricas({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const s = await requirePageSession(["maestro"]);
  const { d, tr } = i18nFor(s.locale);
  const mm = d.master.metrics;

  let from = searchParams.from && isValidYmd(searchParams.from) ? searchParams.from : undefined;
  let to = searchParams.to && isValidYmd(searchParams.to) ? searchParams.to : undefined;
  let invalidRange = false;
  if (from && to && from > to) {
    from = undefined;
    to = undefined;
    invalidRange = true;
  }

  // Misma logica que GET /api/metrics (src/lib/metrics.ts).
  const data = await getMetrics({ from, to });
  const target = data.target_close_rate_pct;

  const countCols = (c: Counts) => (
    <>
      <td className={tdNum}>{c.arrived}</td>
      <td className={tdNum}>{c.unassigned}</td>
      <td className={tdNum}>{c.in_progress}</td>
      <td className={tdNum}>{c.closed}</td>
      <td className={tdNum}>{c.enrolled}</td>
      <td className={tdNum}>{c.not_enrolled}</td>
      <td className={td}>
        <RateBar pct={c.close_rate_pct} target={target} mm={mm} />
      </td>
    </>
  );

  const head = (first: string, withType = false) => (
    <tr>
      <th scope="col" className={th}>
        {first}
      </th>
      {withType && (
        <th scope="col" className={th}>
          {mm.col_type}
        </th>
      )}
      <th scope="col" className={thNum}>{mm.arrived}</th>
      <th scope="col" className={thNum}>{mm.unassigned}</th>
      <th scope="col" className={thNum}>{mm.in_progress}</th>
      <th scope="col" className={thNum}>{mm.closed}</th>
      <th scope="col" className={thNum}>{mm.enrolled}</th>
      <th scope="col" className={thNum}>{mm.not_enrolled}</th>
      <th scope="col" className={th}>{mm.close_rate}</th>
    </tr>
  );

  const t = data.totals;
  const cards: Array<[string, number | string]> = t
    ? [
        [mm.arrived, t.arrived],
        [mm.unassigned, t.unassigned],
        [mm.in_progress, t.in_progress],
        [mm.closed, t.closed],
        [mm.enrolled, t.enrolled],
        [mm.not_enrolled, t.not_enrolled],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{mm.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{mm.definition}</p>
      </div>

      <form method="get" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{mm.from}</span>
          <input type="date" name="from" defaultValue={from ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{mm.to}</span>
          <input type="date" name="to" defaultValue={to ?? ""} className="input" />
        </label>
        <button type="submit" className="btn-primary sm:w-auto sm:min-w-[8rem]">
          {mm.apply}
        </button>
        <Link href="/maestro/metricas" className="flex min-h-touch items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-base">
          {mm.clear}
        </Link>
      </form>
      {invalidRange && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {mm.invalid_range}
        </p>
      )}

      <section aria-label={mm.totals} className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-medium">{mm.close_rate}</p>
            <p className="text-xs text-slate-500">
              {tr("master.metrics.target", { target })} &middot;{" "}
              {tr("master.metrics.baseline", { baseline: data.baseline_close_rate_pct })}
            </p>
          </div>
          <div className="mt-2">
            <RateBar pct={t?.close_rate_pct ?? null} target={target} mm={mm} />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{mm.by_clinic}</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {data.by_clinic.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">{mm.empty}</p>
          ) : (
            <table className="w-full border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">{head(mm.col_clinic)}</thead>
              <tbody className="divide-y divide-slate-100">
                {data.by_clinic.map((c) => (
                  <tr key={c.clinic_id}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      {c.clinic_name}
                    </th>
                    {countCols(c)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{mm.by_producer}</h2>
        <p className="text-xs text-slate-500">{mm.producer_note}</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {data.by_producer.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">{mm.empty}</p>
          ) : (
            <table className="w-full border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">{head(mm.col_producer, true)}</thead>
              <tbody className="divide-y divide-slate-100">
                {data.by_producer.map((p) => (
                  <tr key={p.producer_id}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      {p.producer_name}
                    </th>
                    <td className={td}>
                      {p.producer_type === "dependiente" || p.producer_type === "independiente"
                        ? d.producer_type[p.producer_type]
                        : ""}
                    </td>
                    {countCols(p)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
