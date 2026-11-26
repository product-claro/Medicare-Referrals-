import type { ReferralStatusValue } from "@/lib/referrals/transitions";

// Forma que la API entrega a la clinica (ver serializeReferral, rama role === "clinica").
export interface ClinicReferral {
  id: string;
  ref_number: number;
  ref_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: ReferralStatusValue;
  clinic: { id: string; name: string };
  created_at: string;
  closed_at: string | null;
  plan_name?: string | null;
  enrollment_date?: string | null;
  effective_date?: string | null;
  producer_name?: string | null;
  close_reason?: { code: string; label_es: string; label_en: string } | null;
}
