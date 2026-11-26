"use client";

import { useRouter } from "next/navigation";

// Revoca la sesion en el servidor, borra la cookie y vuelve al login.
export function LogoutButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <button type="button" onClick={logout} className={className ?? "rounded border border-gray-300 px-3 py-2 text-sm"}>
      {label}
    </button>
  );
}
