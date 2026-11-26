import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { RoleShellClientOnly as RoleShell } from "@/components/role-shell-dynamic";
import type { NavItem } from "@/components/role-shell";

export const dynamic = "force-dynamic";

export default async function MaestroLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageSession(["maestro"]);
  const { locale, d } = await i18nFor(s.locale);

  const items: NavItem[] = [
    { key: "/maestro", label: d.master.nav.inbox },
    { key: "/maestro/referidos", label: d.master.nav.referrals },
    { key: "/maestro/metricas", label: d.master.nav.metrics },
    { key: "/maestro/productores", label: d.master.nav.producers },
    { key: "/maestro/clinicas", label: d.master.nav.clinics },
    ...(s.superAdmin ? [{ key: "/maestro/maestros", label: d.master.nav.masters }] : []),
  ];

  return (
    <RoleShell
      title={d.common.app_name}
      subtitle={s.fullName}
      items={items}
      locale={locale}
      logoutLabel={d.common.logout}
      languageLabel={d.common.language}
    >
      {children}
    </RoleShell>
  );
}
