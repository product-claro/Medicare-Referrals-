"use client";

import { useCallback, useEffect, useState } from "react";

// Badge de avisos no leidos: consulta /api/notifications/unread-count cada 20 s y al volver a la pestana.
export function UnreadBadge({ initial, label }: { initial: number; label: string }) {
  const [count, setCount] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      if (typeof data.count === "number") setCount(data.count);
    } catch {
      /* sin red: se mantiene el valor anterior */
    }
  }, []);

  useEffect(() => {
    setCount(initial);
  }, [initial]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  if (count <= 0) return null;
  return (
    <span
      role="status"
      aria-label={`${label}: ${count}`}
      className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
