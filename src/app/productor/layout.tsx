import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { unreadCount } from "@/lib/notifications";
import { i18nFor } from "@/i18n/server";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UnreadBadge } from "@/components/unread-badge";

export const dynamic = "force-dynamic";

export default async function ProductorLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageSession(["productor"]);
  const { locale, d } = i18nFor(s.locale);
  const unread = await unreadCount(s);
  const linkCls =
    "flex min-h-touch flex-1 items-center justify-center rounded-lg border border-slate-200 text-base font-medium hover:bg-brand-50";
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{d.common.app_name}</p>
            <p className="truncate text-xs text-slate-500">{s.fullName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher locale={locale} label={d.common.language} />
            <LogoutButton
              label={d.common.logout}
              className="min-h-[2.5rem] rounded border border-slate-300 bg-white px-3 text-sm"
            />
          </div>
        </div>
        <nav aria-label={d.producer.nav.menu_label} className="mt-3 flex gap-2">
          <Link href="/productor" className={linkCls}>
            {d.producer.nav.referrals}
          </Link>
          <Link href="/productor/avisos" className={linkCls}>
            {d.producer.nav.notices}
            <UnreadBadge initial={unread} label={d.notifications.unread_label} />
          </Link>
        </nav>
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
