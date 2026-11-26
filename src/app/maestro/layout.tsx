import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";

export const dynamic = "force-dynamic";

export default async function MaestroLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageSession(["maestro"]);
  const { locale, d } = await i18nFor(s.locale);
  const linkCls =
    "flex min-h-touch items-center justify-center rounded-lg border border-slate-200 px-4 text-base font-medium hover:bg-brand-50";
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
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
        <nav aria-label={d.master.nav.menu_label} className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Link href="/maestro" className={linkCls}>
            {d.master.nav.inbox}
          </Link>
          <Link href="/maestro/referidos" className={linkCls}>
            {d.master.nav.referrals}
          </Link>
          <Link href="/maestro/metricas" className={linkCls}>
            {d.master.nav.metrics}
          </Link>
          <Link href="/maestro/productores" className={linkCls}>
            {d.master.nav.producers}
          </Link>
          <Link href="/maestro/clinicas" className={linkCls}>
            {d.master.nav.clinics}
          </Link>
          {s.superAdmin && (
            <Link href="/maestro/maestros" className={linkCls}>
              {d.master.nav.masters}
            </Link>
          )}
        </nav>
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
