import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { listNotifications, markAllRead } from "@/lib/notifications";
import { i18nFor } from "@/i18n/server";
import { formatDateTime } from "@/i18n/format";

export const dynamic = "force-dynamic";

// Avisos de asignacion y reasignacion (sin numero de Medicare). Al abrir la pagina se marcan como leidos;
// esta vista conserva el resaltado de los que llegaron sin leer.
export default async function AvisosPage() {
  const s = await requirePageSession(["productor"]);
  const { locale, d, tr } = i18nFor(s.locale);
  const { items, unread } = await listNotifications(s);
  if (unread > 0) await markAllRead(s);
  const n = d.notifications;

  const text = (kind: string, params: Record<string, string | number>) => {
    const ref = String(params.ref_number ?? "").padStart(6, "0");
    if (kind === "referral_assigned") {
      return tr("notifications.referral_assigned", {
        ref_number: ref,
        clinic_name: String(params.clinic_name ?? ""),
        patient_short_name: String(params.patient_short_name ?? ""),
      });
    }
    if (kind === "referral_unassigned") return tr("notifications.referral_unassigned", { ref_number: ref });
    return kind;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{n.title}</h1>
      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">{n.empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className={`rounded-xl border p-4 ${it.read_at ? "border-slate-200 bg-white" : "border-brand-300 bg-brand-50"}`}
            >
              <p className="text-base">
                {!it.read_at && (
                  <span className="mr-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{n.new}</span>
                )}
                {text(it.kind, it.params)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(it.created_at, locale)}</p>
              {it.kind === "referral_assigned" && it.referral_id && (
                <Link
                  href={`/productor/referidos/${it.referral_id}`}
                  className="mt-2 inline-flex min-h-touch items-center font-medium text-brand-700 underline"
                >
                  {n.open_referral}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
