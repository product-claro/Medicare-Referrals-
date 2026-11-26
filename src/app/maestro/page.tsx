import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { appTimezone } from "@/lib/dates";
import { listProducers } from "@/lib/directory";
import { listUnassigned } from "@/lib/referrals/service";
import { AssignInbox } from "./assign-inbox";
import type { MasterReferral, ProducerOption, UiText } from "./types";

export const dynamic = "force-dynamic";

// Criterio UI 2: bandeja unica de referidos sin asignar de todas las clinicas, mas antiguos primero.
export default async function MaestroHome() {
  const s = await requirePageSession(["maestro"]);
  const { locale, d } = await i18nFor(s.locale);
  const [unassigned, producers] = await Promise.all([listUnassigned(s), listProducers("true")]);

  const text: UiText = { m: d.master, common: d.common, status: d.status, producerType: d.producer_type, errors: d.errors };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{d.master.inbox.title}</h1>
        <p className="text-sm text-slate-600">{d.master.inbox.subtitle}</p>
      </div>
      <AssignInbox
        initial={unassigned.items as unknown as MasterReferral[]}
        producers={producers.items as unknown as ProducerOption[]}
        text={text}
        locale={locale}
        timezone={appTimezone()}
      />
    </div>
  );
}
