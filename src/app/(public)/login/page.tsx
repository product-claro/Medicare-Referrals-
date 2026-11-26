import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import es from "@/i18n/dictionaries/es.json";
import en from "@/i18n/dictionaries/en.json";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getSession } from "@/lib/auth/guard";
import { ROLE_HOME } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const dictionaries = { es, en };

async function pickLocale(): Promise<Locale> {
  const c = (await cookies()).get("lang")?.value;
  if (isLocale(c)) return c;
  const al = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  for (const part of al.split(",")) {
    const tag = part.trim().slice(0, 2);
    if (isLocale(tag)) return tag;
  }
  return defaultLocale;
}

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.mustChangePassword ? "/cambiar-clave" : ROLE_HOME[session.role]);

  const locale = await pickLocale();
  const d = dictionaries[locale];
  const labels = {
    appName: d.common.app_name,
    title: d.auth.login_title,
    email: d.auth.email,
    emailPlaceholder: d.auth.email_placeholder,
    password: d.auth.password,
    submit: d.auth.submit,
    submitting: d.auth.signing_in,
    language: d.common.language,
    errors: d.errors as Record<string, string>,
  };
  return <LoginForm locale={locale} labels={labels} />;
}
