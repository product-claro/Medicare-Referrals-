"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, type MasterReferral, type ProducerOption, type UiText } from "./types";

interface Props {
  referralId: string;
  mode: "assign" | "reassign";
  /** Solo reasignar: version leida, para la concurrencia optimista (409 stale_version). */
  version?: number;
  currentProducerId?: string | null;
  producers: ProducerOption[];
  text: UiText;
  /** Muestra el campo de nota (reasignacion). */
  withNote?: boolean;
  compact?: boolean;
  /** Se llama tras asignar / reasignar con el referido actualizado. */
  onDone?: (r: MasterReferral, producerName: string) => void;
  /** Se llama si el servidor responde 409 (otro lo cambio antes). */
  onConflict?: (code: string) => void;
}

// Patron de dos pasos: 1) elegir productor, 2) confirmar con el boton. Sin modales.
export function AssignControl({
  referralId,
  mode,
  version,
  currentProducerId,
  producers,
  text,
  withNote,
  compact,
  onDone,
  onConflict,
}: Props) {
  const router = useRouter();
  const id = useId();
  const [producerId, setProducerId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const a = text.m.assign;

  const options = producers.filter((p) => p.id !== currentProducerId);

  async function submit() {
    if (!producerId || busy) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const body =
        mode === "assign"
          ? { producer_id: producerId }
          : {
              producer_id: producerId,
              expected_version: version,
              ...(note.trim() ? { note: note.trim() } : {}),
            };
      const res = await fetch(`/api/referrals/${referralId}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string = data?.error?.code ?? "internal_error";
        setError(text.errors[code] ?? text.errors.internal_error ?? code);
        setBusy(false);
        if (res.status === 409) onConflict?.(code);
        return;
      }
      const chosen = producers.find((p) => p.id === producerId);
      const name = chosen?.full_name ?? "";
      setOkMsg(fmt(mode === "assign" ? a.assigned_ok : a.reassigned_ok, { producer: name }));
      setProducerId("");
      setNote("");
      setBusy(false);
      onDone?.(data as MasterReferral, name);
      router.refresh();
    } catch {
      setError(text.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  if (options.length === 0) {
    return <p className="text-sm text-slate-500">{a.no_producers}</p>;
  }

  const label = mode === "assign" ? a.assign : a.reassign;
  const busyLabel = mode === "assign" ? a.assigning : a.reassigning;

  return (
    <div className="space-y-2">
      <div className={`flex gap-2 ${compact ? "flex-col sm:flex-row" : "flex-col sm:flex-row sm:items-end"}`}>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-p`} className={compact ? "sr-only" : "mb-1 block text-sm font-medium"}>
            {a.producer_label}
          </label>
          <select
            id={`${id}-p`}
            value={producerId}
            onChange={(e) => setProducerId(e.target.value)}
            disabled={busy}
            className="input"
          >
            <option value="">{a.placeholder}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {fmt(a.option, {
                  name: p.full_name,
                  type: text.producerType[p.producer_type],
                  load: p.open_load,
                })}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!producerId || busy}
          className="btn-primary sm:w-auto sm:min-w-[8rem]"
        >
          {busy ? busyLabel : label}
        </button>
      </div>

      {withNote && (
        <div>
          <label htmlFor={`${id}-n`} className="mb-1 block text-sm font-medium">
            {a.note_label}
          </label>
          <input
            id={`${id}-n`}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            className="input"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-slate-500">{a.note_hint}</p>
        </div>
      )}

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
    </div>
  );
}
