"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Labels {
  appName: string;
  title: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  submit: string;
  submitting: string;
  language: string;
  errors: Record<string, string>;
}

export function LoginForm({ locale, labels }: { locale: "es" | "en"; labels: Labels }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string = data?.error?.code ?? "internal_error";
        setError(labels.errors[code] ?? labels.errors.internal_error ?? code);
        setBusy(false);
        return;
      }
      router.replace(data.home);
      router.refresh();
    } catch {
      setError(labels.errors.internal_error ?? "Error");
      setBusy(false);
    }
  }

  async function setLocale(next: "es" | "en") {
    if (next === locale) return;
    try {
      const res = await fetch("/api/me/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      if (!res.ok) throw new Error("locale");
    } catch {
      // Respaldo si el endpoint aun no existe: la cookie lang tambien la lee el servidor.
      document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    }
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{labels.appName}</h1>
        <div className="flex gap-1 text-sm" role="group" aria-label={labels.language}>
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={l === locale}
              className={`rounded px-2 py-1 uppercase ${l === locale ? "bg-gray-900 text-white" : "border border-gray-300"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <h2 className="text-lg font-medium">{labels.title}</h2>
        <label className="block">
          <span className="mb-1 block text-sm">{labels.email}</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoFocus
            required
            placeholder={labels.emailPlaceholder}
            className="h-12 w-full rounded border border-gray-300 px-3 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">{labels.password}</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-12 w-full rounded border border-gray-300 px-3 text-base"
          />
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
          {busy ? labels.submitting : labels.submit}
        </button>
      </form>
    </main>
  );
}
