"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTime, formatPhone } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { AssignControl } from "./assign-control";
import { fmt, waitLabel, type MasterReferral, type ProducerOption, type UiText } from "./types";

interface Props {
  initial: MasterReferral[];
  producers: ProducerOption[];
  text: UiText;
  locale: Locale;
  timezone: string;
}

// Criterio UI 2: asignar en 2 pasos o menos (elegir productor, confirmar). La fila desaparece al asignar.
export function AssignInbox({ initial, producers, text, locale, timezone }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [stale, setStale] = useState<Set<string>>(new Set());
  const m = text.m;

  const remove = (id: string) => setItems((cur) => cur.filter((r) => r.id !== id));

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
        {m.inbox.empty}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600" aria-live="polite">
        {fmt(m.inbox.total, { count: items.length })}
      </p>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-base font-semibold">
                    {r.first_name} {r.last_name}
                  </p>
                  <Link
                    href={`/maestro/referidos/${r.id}`}
                    className="text-sm text-brand-700 underline"
                    title={m.inbox.view}
                  >
                    {r.ref_code}
                  </Link>
                </div>
                <p className="text-sm text-slate-600">{formatPhone(r.phone)}</p>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="text-slate-500">{m.inbox.clinic}: </span>
                  {r.clinic.name}
                </p>
                <p className="text-xs text-slate-500">
                  {m.inbox.registered} {formatDateTime(r.created_at, locale, timezone)} &middot;{" "}
                  <span className="font-medium text-slate-700">
                    {m.inbox.waiting} {waitLabel(r.waiting_minutes ?? 0, m.wait)}
                  </span>
                </p>
              </div>

              <div>
                {stale.has(r.id) ? (
                  <div className="space-y-2" role="alert">
                    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {text.errors.already_assigned}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="min-h-touch flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      >
                        {m.assign.dismiss}
                      </button>
                      <button
                        type="button"
                        onClick={() => router.refresh()}
                        className="min-h-touch flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      >
                        {m.assign.reload}
                      </button>
                    </div>
                  </div>
                ) : (
                  <AssignControl
                    referralId={r.id}
                    mode="assign"
                    producers={producers}
                    text={text}
                    compact
                    onDone={() => remove(r.id)}
                    onConflict={(code) => {
                      if (code === "already_assigned") setStale((s) => new Set(s).add(r.id));
                    }}
                  />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
