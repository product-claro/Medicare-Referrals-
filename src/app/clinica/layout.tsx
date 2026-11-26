import { requirePageSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { i18nFor } from "@/i18n/server";
import { RoleShellClientOnly as RoleShell } from "@/components/role-shell-dynamic";
import type { NavItem } from "@/components/role-shell";

export const dynamic = "force-dynamic";

export default async function ClinicaLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageSession(["clinica"]);
  const { locale, d } = await i18nFor(s.locale);
  const clinic = s.clinicId
    ? await prisma.clinic.findUnique({ where: { id: s.clinicId }, select: { name: true } })
    : null;

  const items: NavItem[] = [
    { key: "/clinica", label: d.clinic.nav.register },
    { key: "/clinica/referidos", label: d.clinic.nav.referrals },
  ];

  return (
    <RoleShell
      title={clinic?.name ?? d.common.app_name}
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
