"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, type ClinicUserRow, type UiText } from "../../types";

interface Props {
  clinicId: string;
  initial: ClinicUserRow[];
  text: UiText;
}

function errorText(code: string | undefined, text: UiText): string {
  if (!code) return text.errors.internal_error ?? "Error";
  return text.errors[code] ?? text.errors.internal_error ?? code;
}

export function ClinicUsersAdmin({ clinicId, initial, text }: Props) {
  const router = useRouter();
  const c = text.m.clinics;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [clinicAdmin, setClinicAdmin] = useState(false);
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
      const res = await fetch(`/api/clinics/${clinicId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), clinic_admin: clinicAdmin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorText(data?.error?.code, text));
        setBusy(false);
        return;
      }
      setOkMsg(c.user_created_ok);
      setTempNote(fmt(c.temp_password_note, { email: data.email, password: data.temp_password }));
      setFullName("");
      setEmail("");
      setClinicAdmin(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError(text.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  async function toggleActive(row: ClinicUserRow) {
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      if (res.ok) router.refresh();
    } catch {
      // silencioso: el estado visible no cambia si falla, el maestro puede reintentar
    }
  }

  async function toggleClinicAdmin(row: ClinicUserRow) {
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_admin: !row.clinic_admin }),
      });
      if (res.ok) router.refresh();
    } catch {
      // silencioso: el estado visible no cambia si falla, el maestro puede reintentar
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{c.add_user_title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{c.user_full_name}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} className="input" maxLength={160} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{c.user_email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="input"
              autoComplete="off"
            />
          </label>
        </div>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={clinicAdmin}
            onChange={(e) => setClinicAdmin(e.target.checked)}
            disabled={busy}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium">{c.user_clinic_admin_label}</span>
            <span className="block text-xs text-slate-500">{c.user_clinic_admin_hint}</span>
          </span>
        </label>
        <button
          type="button"
          onClick={submitCreate}
          disabled={busy || !fullName.trim() || !email.trim()}
          className="btn-primary sm:w-auto sm:min-w-[10rem]"
        >
          {busy ? c.user_submitting : c.user_submit}
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
        <h2 className="text-lg font-semibold">{c.users_title}</h2>
        {initial.length === 0 ? (
          <p className="text-sm text-slate-600">{c.users_empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.user_col_name}</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.user_col_email}</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.user_col_role}</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.user_col_status}</th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c.user_col_actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initial.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="px-3 py-2 text-left text-sm font-medium">{row.full_name}</th>
                    <td className="px-3 py-2 text-sm">{row.email}</td>
                    <td className="px-3 py-2 text-sm">{row.clinic_admin ? c.role_admin : c.role_staff}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={row.active ? "text-green-700" : "text-slate-500"}>
                        {row.active ? c.active : c.inactive}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleActive(row)}
                          className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-brand-50"
                        >
                          {row.active ? c.deactivate : c.activate}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleClinicAdmin(row)}
                          className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-brand-50"
                        >
                          {row.clinic_admin ? c.remove_admin : c.make_admin}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
