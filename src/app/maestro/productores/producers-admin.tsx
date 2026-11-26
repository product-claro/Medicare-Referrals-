"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, type ProducerImportRow, type ProducerRow, type UiText } from "../types";

interface Props {
  initial: ProducerRow[];
  text: UiText;
}

function errorText(code: string | undefined, text: UiText): string {
  if (!code) return text.errors.internal_error ?? "Error";
  return text.errors[code] ?? text.errors.internal_error ?? code;
}

export function ProducersAdmin({ initial, text }: Props) {
  const router = useRouter();
  const p = text.m.producers;

  const [fullName, setFullName] = useState("");
  const [producerType, setProducerType] = useState<"dependiente" | "independiente">("dependiente");
  const [npn, setNpn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<ProducerImportRow[] | null>(null);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  async function submitCreate() {
    if (busy || !fullName.trim()) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setTempNote(null);
    try {
      const res = await fetch("/api/producers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          producer_type: producerType,
          ...(npn.trim() ? { npn: npn.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(email.trim() && initialPassword.trim() ? { initial_password: initialPassword.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorText(data?.error?.code, text));
        setBusy(false);
        return;
      }
      setOkMsg(p.created_ok);
      if (data.temp_password && data.user?.email) {
        setTempNote(fmt(p.temp_password_note, { email: data.user.email, password: data.temp_password }));
      }
      setFullName("");
      setNpn("");
      setPhone("");
      setEmail("");
      setInitialPassword("");
      setProducerType("dependiente");
      setBusy(false);
      router.refresh();
    } catch {
      setError(text.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  async function toggleActive(row: ProducerRow) {
    try {
      const res = await fetch(`/api/producers/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      if (res.ok) router.refresh();
    } catch {
      // silencioso: el estado visible no cambia si falla, el maestro puede reintentar
    }
  }

  async function resetPassword(row: ProducerRow) {
    if (!row.user) return;
    const newPassword = window.prompt(text.common.reset_password_prompt);
    if (!newPassword) return;
    try {
      const res = await fetch(`/api/users/${row.user.id}`, {
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

  async function submitBulk() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setBulkError(p.no_file);
      return;
    }
    setUploading(true);
    setBulkError(null);
    setBulkResults(null);
    setBulkSummary(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/producers/bulk", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkError(errorText(data?.error?.code, text));
        setUploading(false);
        return;
      }
      setBulkResults(data.items as ProducerImportRow[]);
      setBulkSummary(fmt(p.summary, { created: data.created, errors: data.errors, total: data.total }));
      if (fileRef.current) fileRef.current.value = "";
      setUploading(false);
      router.refresh();
    } catch {
      setBulkError(text.errors.internal_error ?? "Error");
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{p.form_title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{p.full_name}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} className="input" maxLength={160} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{p.producer_type}</span>
            <select
              value={producerType}
              onChange={(e) => setProducerType(e.target.value as "dependiente" | "independiente")}
              disabled={busy}
              className="input"
            >
              <option value="dependiente">{text.producerType.dependiente}</option>
              <option value="independiente">{text.producerType.independiente}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{p.npn}</span>
            <input value={npn} onChange={(e) => setNpn(e.target.value)} disabled={busy} className="input" maxLength={10} />
            <span className="mt-1 block text-xs text-slate-500">{p.npn_hint}</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{p.phone}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} className="input" placeholder="+13055551234" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">{p.email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="input"
              autoComplete="off"
            />
            <span className="mt-1 block text-xs text-slate-500">{p.email_hint}</span>
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
        <button type="button" onClick={submitCreate} disabled={busy || !fullName.trim()} className="btn-primary sm:w-auto sm:min-w-[10rem]">
          {busy ? p.submitting : p.submit}
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
        <h2 className="text-lg font-semibold">{p.bulk_title}</h2>
        <p className="text-sm text-slate-600">{p.bulk_hint}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <a href="/api/producers/template" className="flex min-h-touch items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-base font-medium hover:bg-brand-50 sm:w-auto">
            {p.download_template}
          </a>
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">{p.upload_label}</span>
            <input ref={fileRef} type="file" accept=".xlsx" disabled={uploading} className="input" />
          </label>
          <button type="button" onClick={submitBulk} disabled={uploading} className="btn-primary sm:w-auto sm:min-w-[10rem]">
            {uploading ? p.uploading : p.upload_button}
          </button>
        </div>
        {bulkError && (
          <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {bulkError}
          </p>
        )}
        {bulkResults && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{p.results_title}</h3>
            {bulkSummary && <p className="text-sm text-slate-600">{bulkSummary}</p>}

            {/* Movil: tarjetas apiladas */}
            <div className="space-y-2 sm:hidden">
              {bulkResults.map((r) => (
                <div key={r.row} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {p.col_row} {r.row}
                    </span>
                    <span className={r.status === "created" ? "text-green-700" : "text-amber-700"}>
                      {r.status === "created" ? p.status_created : p.status_error}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {r.status === "created"
                      ? r.temp_password && r.email
                        ? fmt(p.temp_password_note, { email: r.email, password: r.temp_password })
                        : r.full_name
                      : r.error_fields
                        ? Object.values(r.error_fields).join("; ")
                        : errorText(r.error_code, text)}
                  </p>
                </div>
              ))}
            </div>

            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
              <table className="w-full border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {p.col_row}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {p.col_result}
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {p.col_detail}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bulkResults.map((r) => (
                    <tr key={r.row}>
                      <td className="px-3 py-2 text-sm tabular-nums">{r.row}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={r.status === "created" ? "text-green-700" : "text-amber-700"}>
                          {r.status === "created" ? p.status_created : p.status_error}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {r.status === "created"
                          ? r.temp_password && r.email
                            ? fmt(p.temp_password_note, { email: r.email, password: r.temp_password })
                            : r.full_name
                          : r.error_fields
                            ? Object.values(r.error_fields).join("; ")
                            : errorText(r.error_code, text)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{p.list_title}</h2>
        {initial.length === 0 ? (
          <p className="text-sm text-slate-600">{p.empty}</p>
        ) : (
          <>
            {/* Movil: tarjetas apiladas */}
            <div className="space-y-2 sm:hidden">
              {initial.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.full_name}</span>
                    <span className={row.active ? "text-green-700" : "text-slate-500"}>
                      {row.active ? p.active : p.inactive}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">{text.producerType[row.producer_type]}</p>
                  <p className="text-slate-600">
                    {p.col_npn}: {row.npn ?? "—"}
                  </p>
                  <p className="text-slate-600">
                    {p.col_phone}: {row.phone ?? "—"}
                  </p>
                  <p className="text-slate-600">{row.user?.email ?? p.no_email}</p>
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(row)}
                      className="min-h-touch rounded border border-slate-300 bg-white text-sm font-medium hover:bg-brand-50"
                    >
                      {row.active ? p.deactivate : p.activate}
                    </button>
                    {row.user && (
                      <button
                        type="button"
                        onClick={() => resetPassword(row)}
                        className="min-h-touch rounded border border-slate-300 bg-white text-sm font-medium hover:bg-brand-50"
                      >
                        {text.common.reset_password}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
              <table className="w-full border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{p.col_name}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{p.col_type}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{p.col_npn}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{p.col_phone}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{p.col_email}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{p.col_status}</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{p.col_actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initial.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className="px-3 py-2 text-left text-sm font-medium">{row.full_name}</th>
                      <td className="px-3 py-2 text-sm">{text.producerType[row.producer_type]}</td>
                      <td className="px-3 py-2 text-sm">{row.npn ?? "—"}</td>
                      <td className="px-3 py-2 text-sm">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-sm">{row.user?.email ?? p.no_email}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={row.active ? "text-green-700" : "text-slate-500"}>
                          {row.active ? p.active : p.inactive}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleActive(row)}
                            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-brand-50"
                          >
                            {row.active ? p.deactivate : p.activate}
                          </button>
                          {row.user && (
                            <button
                              type="button"
                              onClick={() => resetPassword(row)}
                              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-brand-50"
                            >
                              {text.common.reset_password}
                            </button>
                          )}
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
