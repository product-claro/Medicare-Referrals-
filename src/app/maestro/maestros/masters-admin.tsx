"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, type MasterRow, type UiText } from "../types";

interface Props {
  initial: MasterRow[];
  text: UiText;
}

function errorText(code: string | undefined, text: UiText): string {
  if (!code) return text.errors.internal_error ?? "Error";
  return text.errors[code] ?? text.errors.internal_error ?? code;
}

export function MastersAdmin({ initial, text }: Props) {
  const router = useRouter();
  const m = text.m.masters;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [superAdmin, setSuperAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState<string | null>(null);

  async function submitCreate() {
    if (busy || !fullName.trim() || !email.trim()) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setTempNote(null);
    try {
      const res = await fetch("/api/masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          super_admin: superAdmin,
          ...(initialPassword.trim() ? { initial_password: initialPassword.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorText(data?.error?.code, text));
        setBusy(false);
        return;
      }
      setOkMsg(m.created_ok);
      if (data.temp_password) {
        setTempNote(fmt(m.temp_password_note, { email: data.email, password: data.temp_password }));
      }
      setFullName("");
      setEmail("");
      setInitialPassword("");
      setSuperAdmin(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError(text.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  async function toggleActive(row: MasterRow) {
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      if (res.ok) router.refresh();
    } catch {
      // silencioso: el estado visible no cambia si falla, el administrador puede reintentar
    }
  }

  async function toggleSuperAdmin(row: MasterRow) {
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ super_admin: !row.super_admin }),
      });
      if (res.ok) router.refresh();
    } catch {
      // silencioso: el estado visible no cambia si falla, el administrador puede reintentar
    }
  }

  async function resetPassword(row: MasterRow) {
    const newPassword = window.prompt(text.common.reset_password_prompt);
    if (!newPassword) return;
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(errorText(data?.error?.code, text));
        return;
      }
      window.alert(text.common.reset_password_ok);
      router.refresh();
    } catch {
      window.alert(text.errors.internal_error ?? "Error");
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{m.form_title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{m.full_name}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} className="input" maxLength={160} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{m.email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="input"
              autoComplete="off"
            />
          </label>
          <label className="block">
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
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={superAdmin}
            onChange={(e) => setSuperAdmin(e.target.checked)}
            disabled={busy}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium">{m.super_admin_label}</span>
            <span className="block text-xs text-slate-500">{m.super_admin_hint}</span>
          </span>
        </label>
        <button
          type="button"
          onClick={submitCreate}
          disabled={busy || !fullName.trim() || !email.trim()}
          className="btn-primary sm:w-auto sm:min-w-[10rem]"
        >
          {busy ? m.submitting : m.submit}
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
        <h2 className="text-lg font-semibold">{m.list_title}</h2>
        {initial.length === 0 ? (
          <p className="text-sm text-slate-600">{m.empty}</p>
        ) : (
          <>
            {/* Movil: tarjetas apiladas */}
            <div className="space-y-2 sm:hidden">
              {initial.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.full_name}</span>
                    <span className={row.active ? "text-green-700" : "text-slate-500"}>
                      {row.active ? m.active : m.inactive}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">{row.email}</p>
                  <p className="text-slate-600">{row.super_admin ? m.role_super_admin : m.role_normal}</p>
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(row)}
                      className="min-h-touch rounded border border-slate-300 bg-white text-sm font-medium hover:bg-brand-50"
                    >
                      {row.active ? m.deactivate : m.activate}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSuperAdmin(row)}
                      className="min-h-touch rounded border border-slate-300 bg-white text-sm font-medium hover:bg-brand-50"
                    >
                      {row.super_admin ? m.remove_super_admin : m.make_super_admin}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetPassword(row)}
                      className="min-h-touch rounded border border-slate-300 bg-white text-sm font-medium hover:bg-brand-50"
                    >
                      {text.common.reset_password}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
              <table className="w-full border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{m.col_name}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{m.col_email}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{m.col_role}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{m.col_status}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{m.col_actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initial.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className="px-3 py-2 text-left text-sm font-medium">{row.full_name}</th>
                      <td className="px-3 py-2 text-sm">{row.email}</td>
                      <td className="px-3 py-2 text-sm">{row.super_admin ? m.role_super_admin : m.role_normal}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={row.active ? "text-green-700" : "text-slate-500"}>
                          {row.active ? m.active : m.inactive}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleActive(row)}
                            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-brand-50"
                          >
                            {row.active ? m.deactivate : m.activate}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSuperAdmin(row)}
                            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-brand-50"
                          >
                            {row.super_admin ? m.remove_super_admin : m.make_super_admin}
                          </button>
                          <button
                            type="button"
                            onClick={() => resetPassword(row)}
                            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-brand-50"
                          >
                            {text.common.reset_password}
                          </button>
                        </div>
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
