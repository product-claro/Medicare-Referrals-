"use client";

// Mensaje generico bilingue (los diccionarios se resuelven en el servidor).
export default function ProductorError({ reset }: { error: Error; reset: () => void }) {
  const lang = typeof document !== "undefined" && document.cookie.includes("lang=en") ? "en" : "es";
  return (
    <div className="space-y-4 py-8 text-center">
      <p className="text-lg">{lang === "en" ? "Something went wrong. Please try again." : "Ocurrio un error. Intenta de nuevo."}</p>
      <button type="button" onClick={reset} className="btn-primary max-w-xs">
        {lang === "en" ? "Retry" : "Reintentar"}
      </button>
    </div>
  );
}
