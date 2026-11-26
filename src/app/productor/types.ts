import type { ReferralStatusValue } from "@/lib/referrals/transitions";

// Forma que la API entrega al productor (ver serializeReferral, rama productor / maestro).
export interface ProducerReferral {
  id: string;
  ref_number: number;
  ref_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: ReferralStatusValue;
  clinic: { id: string; name: string };
  created_at: string;
  version: number;
  contact_attempts: number;
  close_reason: { code: string; label_es: string; label_en: string } | null;
  close_reason_detail: string | null;
  plan_name: string | null;
  enrollment_date: string | null;
  effective_date: string | null;
  assigned_at: string | null;
  closed_at: string | null;
}

export interface ReasonOption {
  code: string;
  label: string;
  requires_detail: boolean;
}
