"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";

interface Labels {
  title: string;
  hint: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneHint: string;
  note: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successNumber: string;
  successHint: string;
  registerAnother: string;
  viewReferrals: string;
  required: string;
  invalidPhone: string;
  errors: Record<string, string>;
}

// Solo digitos del telefono nacional (10), sin el prefijo +1.
function nationalDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, 10);
}

function maskPhone(d: string): string {
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function ReferralForm({ labels }: { labels: Labels }) {
  const startedAt = useRef<number | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState(""); // solo digitos
  const [fieldErrors, setFieldErrors] = useState<{ first?: string; last?: string; phone?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // El cronometro del criterio 1 arranca en el primer foco del formulario.
  function markStart() {
    if (startedAt.current === null) startedAt.current = performance.now();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const errs: typeof fieldErrors = {};
    if (!first.trim()) errs.first = labels.required;
    if (!last.trim()) errs.last = labels.required;
    if (phone.length !== 10) errs.phone = labels.invalidPhone;
    setFieldErrors(errs);
    setError(null);
    if (Object.keys(errs).length) {
      const name = errs.first ? "first_name" : errs.last ? "last_name" : "phone";
      (form.elements.namedItem(name) as HTMLElement | null)?.focus();
      return;
    }
    setBusy(true);
    const duration = startedAt.current === null ? undefined : Math.round(performance.now() - startedAt.current);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first.trim(),
          last_name: last.trim(),
          phone: `+1${phone}`,
          ...(duration !== undefined ? { form_duration_ms: duration } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string = data?.error?.code ?? "internal_error";
        setError(labels.errors[code] ?? labels.errors.internal_error ?? code);
        setBusy(false);
        return;
      }
      setDone(data.ref_code ?? `R-${String(data.ref_number).padStart(6, "0")}`);
      setBusy(false);
    } catch {
      setError(labels.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  function reset() {
    setFirst("");
    setLast("");
    setPhone("");
    setFieldErrors({});
    setError(null);
    setDone(null);
    startedAt.current = null;
    // El formulario se vuelve a montar y su primer input recibe el autofocus.
  }

  if (done) {
    return (
      <section className="space-y-5 rounded-xl border border-green-200 bg-green-50 p-5 text-center" role="status">
        <h1 className="text-xl font-semibold text-green-900">{labels.successTitle}</h1>
        <div>
          <p className="text-sm text-green-800">{labels.successNumber}</p>
          <p className="text-4xl font-bold tracking-wide text-green-900">{done}</p>
        </div>
        <p className="text-sm text-green-800">{labels.successHint}</p>
        <button type="button" onClick={reset} autoFocus className="btn-primary h-14 text-lg">
          {labels.registerAnother}
        </button>
        <Link href="/clinica/referidos" className="block min-h-touch py-3 text-base font-medium text-brand-700 underline">
          {labels.viewReferrals}
        </Link>
      </section>
    );
  }

  const inputCls = (bad?: string) => `input h-12 ${bad ? "border-red-500" : ""}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" onFocus={markStart}>
      <div>
        <h1 className="text-xl font-semibold">{labels.title}</h1>
        <p className="text-sm text-slate-600">{labels.hint}</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">{labels.firstName}</span>
        <input
          name="first_name"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          maxLength={80}
          enterKeyHint="next"
          aria-invalid={!!fieldErrors.first}
          className={inputCls(fieldErrors.first)}
        />
        {fieldErrors.first && <span className="mt-1 block text-sm text-red-700">{fieldErrors.first}</span>}
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">{labels.lastName}</span>
        <input
          name="last_name"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          maxLength={80}
          enterKeyHint="next"
          aria-invalid={!!fieldErrors.last}
          className={inputCls(fieldErrors.last)}
        />
        {fieldErrors.last && <span className="mt-1 block text-sm text-red-700">{fieldErrors.last}</span>}
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">{labels.phone}</span>
        <div className="flex">
          <span className="flex h-12 items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 px-3 text-base text-slate-600">
            +1
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={maskPhone(phone)}
            onChange={(e) => setPhone(nationalDigits(e.target.value))}
            placeholder="(305) 555-0100"
            enterKeyHint="done"
            aria-invalid={!!fieldErrors.phone}
            aria-describedby="phone-hint"
            className={`${inputCls(fieldErrors.phone)} rounded-l-none`}
          />
        </div>
        <span id="phone-hint" className={`mt-1 block text-sm ${fieldErrors.phone ? "text-red-700" : "text-slate-500"}`}>
          {fieldErrors.phone ?? labels.phoneHint}
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary h-14 text-lg">
        {busy ? labels.submitting : labels.submit}
      </button>

      <p className="text-xs text-slate-500">{labels.note}</p>
    </form>
  );
}
