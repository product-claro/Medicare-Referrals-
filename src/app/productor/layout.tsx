import { requirePageSession } from "@/lib/auth/guard";
import { unreadCount } from "@/lib/notifications";
import { i18nFor } from "@/i18n/server";
import { RoleShellClientOnly as RoleShell } from "@/components/role-shell-dynamic";
import type { NavItem } from "@/components/role-shell";

export const dynamic = "force-dynamic";

export default async function ProductorLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageSession(["productor"]);
  const { locale, d } = await i18nFor(s.locale);
  const unread = await unreadCount(s);

  const items: NavItem[] = [
    { key: "/productor", label: d.producer.nav.referrals },
    { key: "/productor/avisos", label: unread > 0 ? `${d.producer.nav.notices} (${unread})` : d.producer.nav.notices },
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
