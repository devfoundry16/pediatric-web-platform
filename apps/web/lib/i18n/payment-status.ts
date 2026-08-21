import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function getPaymentStatusLabel(t: Dictionary, status: string): string {
  const map: Record<string, string> = {
    paid: t.admin.common.paid,
    package_credit: t.admin.common.packageCredit,
    refunded: t.admin.common.refunded,
    pending: t.admin.common.pending,
  };
  return map[status] ?? status;
}
