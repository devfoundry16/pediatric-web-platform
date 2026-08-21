import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function getGenderLabel(t: Dictionary, gender: string | null): string {
  if (gender === null) return "—";
  const map: Record<string, string> = {
    male: t.patient.male,
    female: t.patient.female,
    prefer_not_to_say: t.patient.preferNotToSay,
  };
  return map[gender] ?? gender;
}
