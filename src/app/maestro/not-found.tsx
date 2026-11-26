import Link from "next/link";
import { cookies } from "next/headers";
import es from "@/i18n/dictionaries/es.json";
import en from "@/i18n/dictionaries/en.json";

export default function MaestroNotFound() {
  const d = cookies().get("lang")?.value === "en" ? en : es;
  return (
    <div className="space-y-4 py-8 text-center">
      <p className="text-lg">{d.errors.not_found}</p>
      <Link href="/maestro/referidos" className="inline-flex min-h-touch items-center font-medium text-brand-700 underline">
        {d.master.detail.back}
      </Link>
    </div>
  );
}
