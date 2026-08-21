"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Package,
  Clock,
  CalendarDays,
  Zap,
  CheckCircle,
  Loader2,
  AlertCircle,
  History,
  ShoppingCart,
  Minus,
  Plus,
} from "lucide-react";
import { packagesApi } from "@/lib/api/packages";
import type { ConsultationPackage, UserPackage, PackageUsageLog } from "@/types/packages";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const PACKAGE_ICONS: Record<string, typeof Package> = {
  monthly_followup: CalendarDays,
  newborn_care: Package,
  emergency_priority: Zap,
};

const STATUS_VARIANTS: Record<
  UserPackage["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  expired: "secondary",
  exhausted: "outline",
  cancelled: "destructive",
  refunded: "destructive",
};

function statusLabel(t: Dictionary, status: UserPackage["status"]): string {
  const map: Record<UserPackage["status"], string> = {
    active: t.packages.statusActive,
    expired: t.packages.statusExpired,
    exhausted: t.packages.statusExhausted,
    cancelled: t.packages.statusCancelled,
    refunded: t.packages.statusRefunded,
  };
  return map[status] ?? status;
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const MAX_QTY = 10;

interface PackageCardProps {
  pkg: ConsultationPackage;
  onPurchase: (id: string, quantity: number) => void;
  isPurchasing: boolean;
}

function PackageCard({ pkg, onPurchase, isPurchasing }: PackageCardProps) {
  const { dictionary: t } = useI18n();
  const Icon = PACKAGE_ICONS[pkg.slug] ?? Package;
  const isEmergency = pkg.slug === "emergency_priority";
  const [quantity, setQuantity] = useState(1);
  const total = Number(pkg.price_aed) * quantity;

  return (
    <Card className="relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {isEmergency && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
          {t.landing.priorityBadge}
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{pkg.name}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{pkg.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center text-sm">
          <div>
            <p className="font-semibold text-foreground">{pkg.sessions}</p>
            <p className="text-xs text-muted-foreground">{t.packages.sessionsLabel}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {pkg.duration_minutes} {t.appointments.minSuffix}
            </p>
            <p className="text-xs text-muted-foreground">{t.packages.eachLabel}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {t.packages.validityDaysShort.replace(
                "{count}",
                String(pkg.validity_days)
              )}
            </p>
            <p className="text-xs text-muted-foreground">{t.packages.validLabel}</p>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
            {t.packages.featureSessions
              .replace("{sessions}", String(pkg.sessions))
              .replace("{duration}", String(pkg.duration_minutes))}
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
            {t.packages.featureValidity.replace(
              "{days}",
              String(pkg.validity_days)
            )}
          </li>
          {isEmergency && (
            <li className="flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              {t.packages.featurePriority}
            </li>
          )}
        </ul>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t.booking.quantityLabel}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label={t.booking.decreaseQuantity}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center text-sm font-medium">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
                disabled={quantity >= MAX_QTY}
                aria-label={t.booking.increaseQuantity}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-foreground">
                {total.toFixed(0)}
              </span>
              <span className="ml-1 text-sm text-muted-foreground">
                {t.common.aed}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => onPurchase(pkg.id, quantity)}
              disabled={isPurchasing}
            >
              {isPurchasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="mr-1.5 h-4 w-4" />
                  {t.packages.buyNow}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ActivePackageCardProps {
  up: UserPackage;
}

function ActivePackageCard({ up }: ActivePackageCardProps) {
  const { dictionary: t, dateLocale } = useI18n();
  const pkg = up.consultation_packages;
  const Icon = PACKAGE_ICONS[pkg.slug] ?? Package;
  const percent = Math.round((up.credits_remaining / up.credits_total) * 100);
  const days = daysUntil(up.expires_at);
  const isUrgent = days <= 5 && up.status === "active";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{pkg.name}</p>
              <p className="text-sm text-muted-foreground">
                {t.packages.sessionsRemainingOf
                  .replace("{remaining}", String(up.credits_remaining))
                  .replace("{total}", String(up.credits_total))}
              </p>
            </div>
          </div>
          <Badge variant={STATUS_VARIANTS[up.status]}>
            {statusLabel(t, up.status)}
          </Badge>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Progress value={percent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {up.status === "active"
                ? isUrgent
                  ? days === 1
                    ? t.packages.expiresInOneDay
                    : t.packages.expiresInDays.replace("{days}", String(days))
                  : t.packages.expiresOn.replace(
                      "{date}",
                      formatDate(up.expires_at, dateLocale)
                    )
                : t.packages.expiredOn.replace(
                    "{date}",
                    formatDate(up.expires_at, dateLocale)
                  )}
            </span>
            <span>
              {t.packages.purchasedOn.replace(
                "{date}",
                formatDate(up.purchased_at, dateLocale)
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageLogRow({ log }: { log: PackageUsageLog }) {
  const { dictionary: t, dateLocale } = useI18n();
  const appt = log.appointments;
  const pkgName =
    log.user_packages?.consultation_packages?.name ?? t.packages.packageFallback;

  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">{pkgName}</span>
        {appt ? (
          <span className="text-xs text-muted-foreground">
            {formatDate(appt.scheduled_date, dateLocale)} {t.booking.dateTimeAt}{" "}
            {appt.scheduled_time.slice(0, 5)}
            {appt.doctors?.full_name ? ` · ${appt.doctors.full_name}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t.packages.appointmentRemoved}
          </span>
        )}
      </div>
      <Badge variant="outline" className="shrink-0">
        {t.packages.creditsUsed.replace("{count}", String(log.credits_used))}
      </Badge>
    </div>
  );
}

export default function PackagesPage() {
  const { dictionary: t } = useI18n();
  const [availablePackages, setAvailablePackages] = useState<ConsultationPackage[]>([]);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [usageLogs, setUsageLogs] = useState<PackageUsageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<"load" | "checkout" | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setIsLoading(true);
    setError(null);
    try {
      const [pkgs, myPkgs, logs] = await Promise.all([
        packagesApi.list(),
        packagesApi.getMyPackages().catch(() => []),
        packagesApi.getUsageLogs().catch(() => []),
      ]);
      setAvailablePackages(pkgs);
      setUserPackages(myPkgs);
      setUsageLogs(logs);
    } catch {
      setError("load");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePurchase(packageId: string, quantity: number) {
    setPurchasingId(packageId);
    try {
      const url = await packagesApi.createCheckoutSession(packageId, {
        quantity,
        source: "packages",
      });
      window.location.href = url;
    } catch {
      setError("checkout");
      setPurchasingId(null);
    }
  }

  const activePackages = userPackages.filter((up) => up.status === "active");
  const inactivePackages = userPackages.filter((up) => up.status !== "active");

  return (
    <DashboardLayout role="parent">
      <div className="flex flex-col gap-8 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.packages.title}</h1>
          <p className="mt-1 text-muted-foreground">{t.packages.subtitle}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error === "load" ? t.packages.loadError : t.booking.checkoutError}
          </div>
        )}

        {/* Available Packages */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t.packages.availableTitle}
          </h2>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availablePackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onPurchase={handlePurchase}
                  isPurchasing={purchasingId === pkg.id}
                />
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* My Active Packages */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t.packages.activeTitle}
          </h2>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ) : activePackages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Package className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-foreground">
                  {t.packages.emptyTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.packages.emptySubtitle}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {activePackages.map((up) => (
                <ActivePackageCard key={up.id} up={up} />
              ))}
            </div>
          )}
        </section>

        {/* Usage History */}
        {(usageLogs.length > 0 || inactivePackages.length > 0) && (
          <>
            <Separator />
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-foreground">
                {t.packages.historyTitle}
              </h2>
              <Accordion type="multiple" className="flex flex-col gap-3">
                {usageLogs.length > 0 && (
                  <AccordionItem value="usage" className="rounded-xl border">
                    <AccordionTrigger className="rounded-xl px-4 hover:no-underline">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <History className="h-4 w-4 text-muted-foreground" />
                        {t.packages.usageLogTitle.replace(
                          "{count}",
                          String(usageLogs.length)
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="divide-y">
                        {usageLogs.map((log) => (
                          <UsageLogRow key={log.id} log={log} />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {inactivePackages.length > 0 && (
                  <AccordionItem value="past" className="rounded-xl border">
                    <AccordionTrigger className="rounded-xl px-4 hover:no-underline">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {t.packages.pastPackagesTitle.replace(
                          "{count}",
                          String(inactivePackages.length)
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="flex flex-col gap-3">
                        {inactivePackages.map((up) => (
                          <ActivePackageCard key={up.id} up={up} />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
