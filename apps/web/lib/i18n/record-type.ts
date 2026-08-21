import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function getRecordTypeLabel(t: Dictionary, type: string): string {
  const map: Record<string, string> = {
    consultation_note: t.medicalRecords.type_consultation_note,
    prescription: t.medicalRecords.type_prescription,
    diagnosis: t.medicalRecords.type_diagnosis,
    vitals: t.medicalRecords.type_vitals,
    other: t.medicalRecords.type_other,
  };
  return map[type] ?? type;
}
