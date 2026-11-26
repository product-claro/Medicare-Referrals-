"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

interface Labels {
  title: string;
  hint: string;
  current: string;
  next: string;
  confirm: string;
  submit: string;
  mismatch: string;
  logout: string;
  errors: Record<string, string>;
}

export function ChangePasswordForm({ home, labels }: { home: string; labels: Labels }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    if (f.get("new_password") !== f.get("confirm")) {
      setError(labels.mismatch);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: f.get("current_password"), new_password: f.get("new_password") }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code: string = data?.error?.code ?? "internal_error";
        setError(labels.errors[code] ?? labels.errors.internal_error ?? code);
        setBusy(false);
        return;
      }
      router.replace(home);
      router.refresh();
    } catch {
      setError(labels.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  const input = "h-12 w-full rounded border border-gray-300 px-3 text-base";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">{labels.title}</h1>
      <p className="mb-6 text-sm text-gray-600">{labels.hint}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">{labels.current}</span>
          <input name="current_password" type="password" autoComplete="current-password" required className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">{labels.next}</span>
          <input name="new_password" type="password" autoComplete="new-password" minLength={10} required className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">{labels.confirm}</span>
          <input name="confirm" type="password" autoComplete="new-password" minLength={10} required className={input} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded bg-gray-900 text-base font-medium text-white disabled:opacity-60"
        >
          {labels.submit}
        </button>
      </form>
      <div className="mt-6">
        <LogoutButton label={labels.logout} />
      </div>
    </main>
  );
}
