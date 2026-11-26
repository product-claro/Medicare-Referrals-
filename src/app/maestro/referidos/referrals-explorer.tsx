"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { formatDateTime, formatPhone } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { StatusBadge } from "@/components/status-badge";
import { AssignControl } from "../assign-control";
import { fmt, type MasterReferral, type ProducerOption, type UiText } from "../types";

interface Props {
  initial: MasterReferral[];
  total: number;
  producers: ProducerOption[];
  text: UiText;
  locale: Locale;
  timezone: string;
}

const OPEN = ["asignado", "contactado", "sin_contacto"];

// Lista de referidos con busqueda por nombre/telefono (POST: nada del paciente viaja en la URL)
// y asignacion / reasignacion desde la fila con el mismo patron selector + boton.
export function ReferralsExplorer({ initial, total, producers, text, locale, timezone }: Props) {
  const m = text.m;
  const [results, setResults] = useState<{ items: MasterReferral[]; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");

  const shown = results ? results.items : initial;
  const shownTotal = results ? results.total : total;

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const body: Record<string, string> = {};
    if (first.trim()) body.first_name = first.trim();
    if (last.trim()) body.last_name = last.trim();
    if (phone.trim().replace(/\D/g, "").length >= 3) body.phone = phone.trim();
    if (Object.keys(body).length === 0) {
      setError(m.referrals.search_need_criteria);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/referrals/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, page: 1, page_size: 50 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string = data?.error?.code ?? "internal_error";
        setError(text.errors[code] ?? text.errors.internal_error ?? code);
      } else {
        setResults({ items: data.items as MasterReferral[], total: Number(data.total) || 0 });
      }
    } catch {
      setError(text.errors.internal_error ?? "Error");
    }
    setBusy(false);
  }

  function clearSearch() {
    setResults(null);
    setFirst("");
    setLast("");
    setPhone("");
    setError(null);
  }

  function replaceRow(updated: MasterReferral) {
    setResults((cur) => (cur ? { ...cur, items: cur.items.map((r) => (r.id === updated.id ? updated : r)) } : cur));
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onSearch}
        noValidate
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        aria-label={m.referrals.search_title}
      >
        <div>
          <h2 className="text-base font-semibold">{m.referrals.search_title}</h2>
          <p className="text-xs text-slate-500">{m.referrals.search_hint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{m.referrals.first_name}</span>
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              maxLength={80}
              autoComplete="off"
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{m.referrals.last_name}</span>
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              maxLength={80}
              autoComplete="off"
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{m.referrals.phone}</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              maxLength={40}
              autoComplete="off"
              className="input"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" disabled={busy} className="btn-primary sm:w-auto sm:min-w-[8rem]">
            {busy ? m.referrals.searching : m.referrals.search}
          </button>
          {results && (
            <button
              type="button"
              onClick={clearSearch}
              className="min-h-touch rounded-lg border border-slate-300 bg-white px-4 text-base"
            >
              {m.referrals.search_clear}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        )}
      </form>

      <p className="text-sm text-slate-600" aria-live="polite">
        {results ? fmt(m.referrals.search_results, { count: shownTotal }) : fmt(m.referrals.total, { count: shownTotal })}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
          {m.referrals.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const mode = r.status === "nuevo" ? "assign" : OPEN.includes(r.status) ? "reassign" : null;
            return (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-base font-semibold">
                        {r.first_name} {r.last_name}
                      </p>
                      <StatusBadge status={r.status} label={text.status[r.status]} />
                    </div>
                    <p className="text-sm text-slate-600">{formatPhone(r.phone)}</p>
                    <p className="text-sm">
                      <span className="text-slate-500">{m.referrals.col_clinic}: </span>
                      {r.clinic.name}
                    </p>
                    <p className="text-sm">
                      <span className="text-slate-500">{m.referrals.col_producer}: </span>
                      {r.producer ? (
                        <>
                          {r.producer.full_name}{" "}
                          <span className="text-xs text-slate-500">({text.producerType[r.producer.producer_type]})</span>
                        </>
                      ) : (
                        <span className="text-slate-500">{m.referrals.no_producer}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      <Link href={`/maestro/referidos/${r.id}`} className="text-brand-700 underline">
                        {r.ref_code}
                      </Link>{" "}
                      &middot; {formatDateTime(r.created_at, locale, timezone)}
                    </p>
                  </div>
                  <div>
                    {mode && (
                      <AssignControl
                        // La clave incluye la version: al cambiar el referido el control se reinicia.
                        key={`${r.id}-${r.version}`}
                        referralId={r.id}
                        mode={mode}
                        version={r.version}
                        currentProducerId={r.producer?.id ?? null}
                        producers={producers}
                        text={text}
                        compact
                        onDone={(updated) => replaceRow(updated)}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
