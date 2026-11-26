"use client";

import { useRouter } from "next/navigation";

export function LanguageSwitcher({ locale, label }: { locale: "es" | "en"; label: string }) {
  const router = useRouter();
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
      document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    }
    router.refresh();
  }
  return (
    <div className="flex gap-1 text-sm" role="group" aria-label={label}>
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={l === locale}
          className={`min-h-[2.5rem] rounded px-3 uppercase ${l === locale ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
