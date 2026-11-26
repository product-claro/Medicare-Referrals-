"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmt, type ClinicRow, type UiText } from "../types";

interface Props {
  initial: ClinicRow[];
  text: UiText;
}

function errorText(code: string | undefined, text: UiText): string {
  if (!code) return text.errors.internal_error ?? "Error";
  return text.errors[code] ?? text.errors.internal_error ?? code;
}

export function ClinicsAdmin({ initial, text }: Props) {
  const router = useRouter();
  const c = text.m.clinics;

  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState<string | null>(null);

  async function submitCreate() {
    if (busy || !name.trim() || !adminName.trim() || !adminEmail.trim()) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setTempNote(null);
    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          full_name: adminName.trim(),
          email: adminEmail.trim(),
          ...(initialPassword.trim() ? { initial_password: initialPassword.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorText(data?.error?.code, text));
        setBusy(false);
        return;
      }
      setOkMsg(c.created_ok);
      if (data.user?.temp_password && data.user?.email) {
        setTempNote(fmt(c.temp_password_note, { email: data.user.email, password: data.user.temp_password }));
      }
      setName("");
      setAdminName("");
      setAdminEmail("");
      setInitialPassword("");
      setBusy(false);
      router.refresh();
    } catch {
      setError(text.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  async function toggleActive(row: ClinicRow) {
    try {
      const res = await fetch(`/api/clinics/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      if (res.ok) router.refresh();
    } catch {
      // silencioso: el estado visible no cambia si falla, el maestro puede reintentar
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{c.form_title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">{c.name}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} className="input" maxLength={200} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{c.admin_name}</span>
            <input value={adminName} onChange={(e) => setAdminName(e.target.value)} disabled={busy} className="input" maxLength={160} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{c.admin_email}</span>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              disabled={busy}
              className="input"
              autoComplete="off"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">{text.common.initial_password_label}</span>
            <input
              type="text"
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              disabled={busy}
              className="input"
              autoComplete="off"
              maxLength={200}
            />
            <span className="mt-1 block text-xs text-slate-500">{text.common.initial_password_hint}</span>
          </label>
        </div>
        <button
          type="button"
          onClick={submitCreate}
          disabled={busy || !name.trim() || !adminName.trim() || !adminEmail.trim()}
          className="btn-primary sm:w-auto sm:min-w-[10rem]"
        >
          {busy ? c.submitting : c.submit}
        </button>
        {error && (
          <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        )}
        {okMsg && (
          <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            {okMsg}
          </p>
        )}
        {tempNote && (
          <p role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
            {tempNote}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{c.list_title}</h2>
        {initial.length === 0 ? (
          <p className="text-sm text-slate-600">{c.empty}</p>
        ) : (
          <>
            {/* Movil: tarjetas apiladas */}
            <div className="space-y-2 sm:hidden">
              {initial.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/maestro/clinicas/${row.id}`} className="font-medium text-brand-700 underline hover:no-underline">
                      {row.name}
                    </Link>
                    <span className={row.active ? "text-green-700" : "text-slate-500"}>
                      {row.active ? c.active : c.inactive}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {c.col_users}: {row.users_count ?? 0} &middot; {c.col_referrals}: {row.referrals_count ?? 0}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleActive(row)}
                    className="mt-2 min-h-touch w-full rounded border border-slate-300 bg-white text-sm font-medium hover:bg-brand-50"
                  >
                    {row.active ? c.deactivate : c.activate}
                  </button>
                </div>
              ))}
            </div>

            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
              <table className="w-full border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.col_name}</th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{c.col_users}</th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{c.col_referrals}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.col_status}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.col_actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initial.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className="px-3 py-2 text-left text-sm font-medium">
                        <Link href={`/maestro/clinicas/${row.id}`} className="text-brand-700 underline hover:no-underline">
                          {row.name}
                        </Link>
                      </th>
                      <td className="px-3 py-2 text-right text-sm tabular-nums">{row.users_count ?? 0}</td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums">{row.referrals_count ?? 0}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={row.active ? "text-green-700" : "text-slate-500"}>
                          {row.active ? c.active : c.inactive}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => toggleActive(row)}
                          className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-brand-50"
                        >
                          {row.active ? c.deactivate : c.activate}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
