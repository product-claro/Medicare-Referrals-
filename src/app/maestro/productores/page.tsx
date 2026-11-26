import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { listProducers } from "@/lib/directory";
import { ProducersAdmin } from "./producers-admin";
import type { ProducerRow, UiText } from "../types";

export const dynamic = "force-dynamic";

export default async function MaestroProductores() {
  const s = await requirePageSession(["maestro"]);
  const { d } = i18nFor(s.locale);
  const producers = await listProducers("all");
  const text: UiText = { m: d.master, status: d.status, producerType: d.producer_type, errors: d.errors };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{d.master.producers.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{d.master.producers.subtitle}</p>
      </div>
      <ProducersAdmin initial={producers.items as unknown as ProducerRow[]} text={text} />
    </div>
  );
}
