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
};

const STATUS_LABELS: Record<UserPackage["status"], string> = {
  active: "Active",
  expired: "Expired",
  exhausted: "Used up",
  cancelled: "Cancelled",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", {
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
  const Icon = PACKAGE_ICONS[pkg.slug] ?? Package;
  const isEmergency = pkg.slug === "emergency_priority";
  const [quantity, setQuantity] = useState(1);
  const total = Number(pkg.price_aed) * quantity;

  return (
    <Card className="relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {isEmergency && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
          Priority
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
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{pkg.duration_minutes} min</p>
            <p className="text-xs text-muted-foreground">Each</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{pkg.validity_days}d</p>
            <p className="text-xs text-muted-foreground">Valid</p>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
            {pkg.sessions} × {pkg.duration_minutes}-minute consultations
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
            Valid for {pkg.validity_days} days from purchase
          </li>
          {isEmergency && (
            <li className="flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              Guaranteed slot within 2 hours
            </li>
          )}
        </ul>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quantity</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
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
                aria-label="Increase quantity"
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
              <span className="ml-1 text-sm text-muted-foreground">AED</span>
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
                  Buy Now
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
                {up.credits_remaining} of {up.credits_total} sessions remaining
              </p>
            </div>
          </div>
          <Badge variant={STATUS_VARIANTS[up.status]}>{STATUS_LABELS[up.status]}</Badge>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Progress value={percent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {up.status === "active"
                ? isUrgent
                  ? `Expires in ${days} day${days !== 1 ? "s" : ""} — use soon!`
                  : `Expires ${formatDate(up.expires_at)}`
                : `Expired ${formatDate(up.expires_at)}`}
            </span>
            <span>Purchased {formatDate(up.purchased_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageLogRow({ log }: { log: PackageUsageLog }) {
  const appt = log.appointments;
  const pkgName = log.user_packages?.consultation_packages?.name ?? "Package";

  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">{pkgName}</span>
        {appt ? (
          <span className="text-xs text-muted-foreground">
            {formatDate(appt.scheduled_date)} at {appt.scheduled_time.slice(0, 5)}
            {appt.doctors?.full_name ? ` · ${appt.doctors.full_name}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Appointment removed</span>
        )}
      </div>
      <Badge variant="outline" className="shrink-0">
        −{log.credits_used} credit{log.credits_used !== 1 ? "s" : ""}
      </Badge>
    </div>
  );
}

export default function PackagesPage() {
  const [availablePackages, setAvailablePackages] = useState<ConsultationPackage[]>([]);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [usageLogs, setUsageLogs] = useState<PackageUsageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError("Failed to load packages. Please try again.");
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
      setError("Could not start checkout. Please try again.");
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
          <h1 className="text-2xl font-bold text-foreground">Consultation Packages</h1>
          <p className="mt-1 text-muted-foreground">
            Purchase bundled consultation sessions and save on your child&apos;s care.
            Credits are automatically deducted when you book an appointment.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Available Packages */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">Available Packages</h2>
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
          <h2 className="text-lg font-semibold text-foreground">My Active Packages</h2>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ) : activePackages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Package className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No active packages</p>
                <p className="text-sm text-muted-foreground">
                  Purchase a package above to get started.
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
              <h2 className="text-lg font-semibold text-foreground">History</h2>
              <Accordion type="multiple" className="flex flex-col gap-3">
                {usageLogs.length > 0 && (
                  <AccordionItem value="usage" className="rounded-xl border">
                    <AccordionTrigger className="rounded-xl px-4 hover:no-underline">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <History className="h-4 w-4 text-muted-foreground" />
                        Credit Usage Log ({usageLogs.length})
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
                        Past Packages ({inactivePackages.length})
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
