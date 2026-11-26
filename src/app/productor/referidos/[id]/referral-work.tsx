"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/t";
import type { ReasonOption } from "../../types";

interface Props {
  referralId: string;
  version: number;
  reasons: ReasonOption[];
  text: { w: Dictionary["producer"]["work"]; errors: Record<string, string> };
}

type Outcome = "inscrito" | "no_inscrito";

// Registrar contacto (Contactado / Sin contacto) y cerrar (Inscrito / No inscrito). Todo va a la API REST;
// la base y el service vuelven a validar (motivo obligatorio, fechas, MBI).
export function ReferralWork({ referralId, version, reasons, text }: Props) {
  const router = useRouter();
  const uid = useId();
  const w = text.w;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("inscrito");
  const [plan, setPlan] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [effective, setEffective] = useState("");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const selected = reasons.find((r) => r.code === reason);

  async function post(path: string, body: unknown, success: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/referrals/${referralId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string = data?.error?.code ?? "internal_error";
        setError(text.errors[code] ?? text.errors.internal_error ?? code);
        setBusy(false);
        return;
      }
      setOk(success);
      setNote("");
      setBusy(false);
      router.refresh();
    } catch {
      setError(text.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  function attempt(result: "contactado" | "sin_contacto") {
    if (busy) return;
    void post(
      "attempts",
      { outcome: result, expected_version: version, ...(note.trim() ? { note: note.trim() } : {}) },
      w.contact_saved,
    );
  }

  function close(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    if (outcome === "inscrito") {
      if (!plan.trim()) errs.plan = w.required;
      if (!enrollment) errs.enrollment = w.required;
      if (!effective) errs.effective = w.required;
      if (enrollment && effective && effective < enrollment) errs.effective = w.effective_before_enrollment;
    } else {
      if (!reason) errs.reason = w.reason_missing;
      else if (selected?.requires_detail && !detail.trim()) errs.detail = w.required;
    }
    setFieldErr(errs);
    if (Object.keys(errs).length) return;
    const body =
      outcome === "inscrito"
        ? {
            outcome,
            plan_name: plan.trim(),
            enrollment_date: enrollment,
            effective_date: effective,
            expected_version: version,
          }
        : {
            outcome,
            reason_code: reason,
            ...(detail.trim() ? { reason_detail: detail.trim() } : {}),
            expected_version: version,
          };
    void post("close", body, w.closed_ok);
  }

  const err = (k: string) =>
    fieldErr[k] ? (
      <p role="alert" className="mt-1 text-sm text-red-700">
        {fieldErr[k]}
      </p>
    ) : null;

  const tab = (v: Outcome, label: string) => (
    <button
      type="button"
      onClick={() => {
        setOutcome(v);
        setFieldErr({});
      }}
      aria-pressed={outcome === v}
      className={`flex min-h-touch flex-1 items-center justify-center rounded-lg border text-base font-semibold ${
        outcome === v ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">{w.contact_title}</h2>
        <div>
          <label htmlFor={`${uid}-note`} className="mb-1 block text-sm font-medium">
            {w.note_label}
          </label>
          <input
            id={`${uid}-note`}
            className="input"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-slate-500">{w.note_hint}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => attempt("contactado")}>
            {busy ? w.saving : w.contacted}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => attempt("sin_contacto")}
            className="min-h-touch w-full rounded-lg border border-slate-400 bg-white px-4 text-base font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {w.no_contact}
          </button>
        </div>
      </section>

      <form onSubmit={close} noValidate className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">{w.close_title}</h2>
        <div className="flex gap-2" role="group" aria-label={w.close_title}>
          {tab("inscrito", w.outcome_enrolled)}
          {tab("no_inscrito", w.outcome_not_enrolled)}
        </div>

        {outcome === "inscrito" ? (
          <>
            <div>
              <label htmlFor={`${uid}-plan`} className="mb-1 block text-sm font-medium">
                {w.plan}
              </label>
              <input
                id={`${uid}-plan`}
                className="input"
                value={plan}
                maxLength={200}
                onChange={(e) => setPlan(e.target.value)}
                disabled={busy}
                autoComplete="off"
              />
              {err("plan")}
            </div>
            <div>
              <label htmlFor={`${uid}-enr`} className="mb-1 block text-sm font-medium">
                {w.enrollment_date}
              </label>
              <input
                id={`${uid}-enr`}
                type="date"
                className="input"
                value={enrollment}
                onChange={(e) => setEnrollment(e.target.value)}
                disabled={busy}
              />
              {err("enrollment")}
            </div>
            <div>
              <label htmlFor={`${uid}-eff`} className="mb-1 block text-sm font-medium">
                {w.effective_date}
              </label>
              <input
                id={`${uid}-eff`}
                type="date"
                className="input"
                value={effective}
                min={enrollment || undefined}
                onChange={(e) => setEffective(e.target.value)}
                disabled={busy}
              />
              {err("effective")}
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor={`${uid}-reason`} className="mb-1 block text-sm font-medium">
                {w.reason}
              </label>
              <select
                id={`${uid}-reason`}
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              >
                <option value="">{w.reason_placeholder}</option>
                {reasons.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
              {err("reason")}
            </div>
            <div>
              <label htmlFor={`${uid}-detail`} className="mb-1 block text-sm font-medium">
                {w.reason_detail}
              </label>
              <input
                id={`${uid}-detail`}
                className="input"
                value={detail}
                maxLength={500}
                onChange={(e) => setDetail(e.target.value)}
                disabled={busy}
                autoComplete="off"
              />
              {selected?.requires_detail && <p className="mt-1 text-xs text-slate-500">{w.reason_detail_hint}</p>}
              {err("detail")}
            </div>
          </>
        )}

        <p className="text-xs text-slate-500">{w.final_warning}</p>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? w.saving : outcome === "inscrito" ? w.save_enrolled : w.save_not_enrolled}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {ok}
        </p>
      )}
    </div>
  );
}
