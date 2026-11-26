"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Inbox, ListChecks, BarChart3, Users, Building2, ShieldCheck, ClipboardPlus, Bell } from "lucide-react";
import { AppShell, MenuLateral, type ContextoMenu, type NavNode } from "@arc2-0/claro-one-kit";
import { LogoutButton } from "./logout-button";
import { LanguageSwitcher } from "./language-switcher";

// Los componentes de icono no se pueden pasar de un Server Component a este Client Component (no
// son datos planos serializables), asi que el layout del servidor solo manda {key, label} (texto
// plano) y el icono se resuelve aca, del lado del cliente, por ruta. Una sola tabla para los 3 roles:
// las claves (rutas) nunca chocan entre si.
const ICONOS_POR_RUTA: Record<string, typeof Inbox> = {
  "/maestro": Inbox,
  "/maestro/referidos": ListChecks,
  "/maestro/metricas": BarChart3,
  "/maestro/productores": Users,
  "/maestro/clinicas": Building2,
  "/maestro/maestros": ShieldCheck,
  "/clinica": ClipboardPlus,
  "/clinica/referidos": ListChecks,
  "/productor": ListChecks,
  "/productor/avisos": Bell,
};

export interface NavItem {
  key: string;
  label: string;
}

interface Props {
  title: string;
  subtitle: string;
  items: NavItem[];
  locale: "es" | "en";
  logoutLabel: string;
  languageLabel: string;
  children: React.ReactNode;
}

// Chrome compartido por los 3 roles: AppShell + MenuLateral del kit de Claro One, en vez de la
// barra superior con botones envueltos que se armaba a mano.
export function RoleShell({ title, subtitle, items, locale, logoutLabel, languageLabel, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const navItems: NavNode[] = items.map((i) => ({ key: i.key, label: i.label, icon: ICONOS_POR_RUTA[i.key] }));

  return (
    <AppShell
      title={title}
      collapsed={collapsed}
      onToggle={() => setCollapsed((c) => !c)}
      sider={({ enCelular, cerrar }: ContextoMenu) => (
        <MenuLateral
          items={navItems}
          selectedKey={pathname}
          onSelect={(key) => {
            router.push(key);
            if (enCelular) cerrar();
          }}
          collapsed={enCelular ? false : collapsed}
          onToggle={enCelular ? undefined : () => setCollapsed((c) => !c)}
        />
      )}
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</span>
          <LanguageSwitcher locale={locale} label={languageLabel} />
          <LogoutButton label={logoutLabel} className="min-h-[2.5rem] rounded border border-slate-300 bg-white px-3 text-sm" />
        </div>
      }
    >
      <div className="p-4">{children}</div>
    </AppShell>
  );
}
