import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ConsultationTypeId } from "@/types/appointment";

export function getConsultationTypeLabel(
  t: Dictionary,
  id: ConsultationTypeId | string
): string {
  switch (id) {
    case "quick":
      return t.landing.quick;
    case "standard":
      return t.landing.standard;
    case "extended":
      return t.landing.extended;
    default:
      return id;
  }
}
