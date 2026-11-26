import { requirePageSession } from "@/lib/auth/guard";
import { i18nFor } from "@/i18n/server";
import { ReferralForm } from "./referral-form";

export const dynamic = "force-dynamic";

// Criterio UI 1: registrar un paciente en menos de 1 minuto desde el telefono. Solo 3 campos.
export default async function ClinicaHome() {
  const s = await requirePageSession(["clinica"]);
  const { d } = i18nFor(s.locale);
  const f = d.clinic.form;
  return (
    <ReferralForm
      labels={{
        title: f.title,
        hint: f.hint,
        firstName: f.first_name,
        lastName: f.last_name,
        phone: f.phone,
        phoneHint: f.phone_hint,
        note: f.no_medicare_note,
        submit: f.submit,
        submitting: f.submitting,
        successTitle: f.success_title,
        successNumber: f.success_number,
        successHint: f.success_hint,
        registerAnother: f.register_another,
        viewReferrals: f.view_referrals,
        required: f.required,
        invalidPhone: f.invalid_phone,
        errors: d.errors as Record<string, string>,
      }}
    />
  );
}
