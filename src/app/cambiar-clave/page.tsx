import es from "@/i18n/dictionaries/es.json";
import en from "@/i18n/dictionaries/en.json";
import { requirePageSession } from "@/lib/auth/guard";
import { ROLE_HOME } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function CambiarClavePage() {
  const s = await requirePageSession(undefined, { allowMustChange: true });
  const d = s.locale === "en" ? en : es;
  return (
    <ChangePasswordForm
      home={ROLE_HOME[s.role]}
      labels={{
        title: d.auth.change_password_title,
        hint: d.auth.change_password_hint,
        current: d.auth.current_password,
        next: d.auth.new_password,
        confirm: d.auth.confirm_password,
        submit: d.auth.change_password_submit,
        mismatch: d.auth.passwords_do_not_match,
        logout: d.auth.logout,
        errors: d.errors as Record<string, string>,
      }}
    />
  );
}
