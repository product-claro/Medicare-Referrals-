import Link from "next/link";
import { requirePageSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { i18nFor } from "@/i18n/server";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";

export const dynamic = "force-dynamic";

export default async function ClinicaLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageSession(["clinica"]);
  const { locale, d } = i18nFor(s.locale);
  const clinic = s.clinicId
    ? await prisma.clinic.findUnique({ where: { id: s.clinicId }, select: { name: true } })
    : null;
  const linkCls =
    "flex min-h-touch flex-1 items-center justify-center rounded-lg border border-slate-200 text-base font-medium hover:bg-brand-50";
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{clinic?.name ?? d.common.app_name}</p>
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
        <nav aria-label={d.clinic.nav.menu_label} className="mt-3 flex gap-2">
          <Link href="/clinica" className={linkCls}>
            {d.clinic.nav.register}
          </Link>
          <Link href="/clinica/referidos" className={linkCls}>
            {d.clinic.nav.referrals}
          </Link>
        </nav>
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
