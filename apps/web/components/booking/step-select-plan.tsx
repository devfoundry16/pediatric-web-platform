"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  Minus,
  Plus,
  Loader2,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";
import { CONSULTATION_TYPES } from "@/types/appointment";
import { packagesApi } from "@/lib/api/packages";
import type { ConsultationPackage } from "@/types/packages";

const MAX_QTY = 10;

interface StepSelectPlanProps {
  childId: string;
  selected: string;
  onSelectOneTime: () => void;
  // When set, render only this package as a purchase confirmation (no one-time
  // card, no other packages) — used when a package was pre-selected on the
  // landing page and the user has no credit yet.
  restrictToSlug?: string;
}

// Entry screen for the booking flow: pick the one-time consultation or buy a
// package (with quantity) to cover repeat consultations. Buying a package
// redirects to Stripe and returns into the booking flow (see booking/page.tsx).
export function StepSelectPlan({
  childId,
  selected,
  onSelectOneTime,
  restrictToSlug,
}: StepSelectPlanProps) {
  const { dictionary: t } = useI18n();
  const consult = CONSULTATION_TYPES[0];

  const [packages, setPackages] = useState<ConsultationPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    packagesApi
      .list()
      .then(setPackages)
      .catch(() => setError(t.booking.checkoutError))
      .finally(() => setLoading(false));
  }, [t.booking.checkoutError]);

  const visiblePackages = restrictToSlug
    ? packages.filter((p) => p.slug === restrictToSlug)
    : packages;

  const qtyFor = (id: string) => quantities[id] ?? 1;
  const setQty = (id: string, n: number) =>
    setQuantities((q) => ({ ...q, [id]: Math.min(MAX_QTY, Math.max(1, n)) }));

  async function handleBuy(pkg: ConsultationPackage) {
    setPurchasingId(pkg.id);
    setError(null);
    try {
      const url = await packagesApi.createCheckoutSession(pkg.id, {
        quantity: qtyFor(pkg.id),
        source: "booking",
        childId,
      });
      window.location.href = url;
    } catch {
      setError(t.booking.checkoutError);
      setPurchasingId(null);
    }
  }

  const oneTimeSelected = selected === consult.id;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-foreground">
        {restrictToSlug ? t.booking.confirmPackageTitle : t.booking.choosePlanTitle}
      </h2>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* One-time consultation (hidden when a specific package is pre-selected) */}
      {!restrictToSlug && (
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            oneTimeSelected
              ? "border-primary ring-1 ring-primary/20"
              : "border-border"
          )}
          onClick={onSelectOneTime}
        >
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-foreground">
                {t.booking.oneTimeTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.booking.oneTimeDescription}
              </p>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {consult.duration} {t.common.minutes}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-2xl font-bold text-foreground">
                {consult.price}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {t.common.aed}
                </span>
              </p>
              {oneTimeSelected && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Packages */}
      <div className="flex flex-col gap-3">
        {!restrictToSlug && (
          <h3 className="text-sm font-medium text-muted-foreground">
            {t.booking.packagesHeading}
          </h3>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePackages.map((pkg) => {
              const qty = qtyFor(pkg.id);
              const total = Number(pkg.price_aed) * qty;
              return (
                <Card key={pkg.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-4 p-5">
                    <div>
                      <p className="font-semibold text-foreground">{pkg.name}</p>
                      {pkg.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pkg.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center text-xs">
                      <div>
                        <p className="font-semibold text-foreground">
                          {pkg.sessions}
                        </p>
                        <p className="text-muted-foreground">
                          {t.booking.sessionsSuffix}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {pkg.duration_minutes}m
                        </p>
                        <p className="text-muted-foreground">
                          {t.booking.eachLabel}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {pkg.validity_days}d
                        </p>
                        <p className="text-muted-foreground">
                          {t.booking.validLabel}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t.booking.quantityLabel}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setQty(pkg.id, qty - 1)}
                            disabled={qty <= 1}
                            aria-label={t.booking.decreaseQuantity}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">
                            {qty}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setQty(pkg.id, qty + 1)}
                            disabled={qty >= MAX_QTY}
                            aria-label={t.booking.increaseQuantity}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t.booking.total}
                        </span>
                        <span className="text-xl font-bold text-foreground">
                          {total}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {t.common.aed}
                          </span>
                        </span>
                      </div>

                      <Button
                        onClick={() => handleBuy(pkg)}
                        disabled={purchasingId !== null}
                      >
                        {purchasingId === pkg.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingCart className="mr-1.5 h-4 w-4" />
                            {t.booking.buyAndContinue}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
