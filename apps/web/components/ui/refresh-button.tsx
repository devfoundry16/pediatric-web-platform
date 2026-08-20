"use client";

import { useState } from "react";
import { RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n-context";
import { cn } from "@/lib/utils";

/**
 * Re-fetches a page whose data the server can change on its own — a payment
 * settling, a room being provisioned, a doctor going live — so a stale view is
 * one click to correct rather than a full reload.
 *
 * The page's loader is expected to take a `silent` flag and skip its skeleton
 * state when set, so pressing this leaves the content in place and only spins
 * the icon. Without that the list blinks and loses scroll position on every
 * press, which is worse than the staleness it fixes.
 */
interface RefreshButtonProps {
  /** The page's loader. A returned promise is awaited to time the spinner. */
  onRefresh: () => void | Promise<unknown>;
  /**
   * Use the alternate glyph where RefreshCw already means something else on
   * the same screen (parent appointments uses it for Reschedule).
   */
  variant?: "refresh" | "rotate";
  className?: string;
}

/** Long enough that a fast response still registers as a deliberate action. */
const MINIMUM_SPIN_MS = 400;

export function RefreshButton({ onRefresh, variant = "refresh", className }: RefreshButtonProps) {
  const { dictionary: t } = useI18n();
  const [busy, setBusy] = useState(false);

  const Icon = variant === "rotate" ? RotateCw : RefreshCw;

  async function handleClick() {
    // Guards against a double click issuing two overlapping fetches.
    if (busy) return;
    setBusy(true);
    const startedAt = Date.now();
    try {
      await onRefresh();
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MINIMUM_SPIN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MINIMUM_SPIN_MS - elapsed));
      }
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={busy}
      // Icon-only, so it needs a name for screen readers and a hover hint.
      aria-label={t.common.refresh}
      title={t.common.refresh}
      className={cn("h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground", className)}
    >
      <Icon className={cn("h-4 w-4", busy && "animate-spin")} />
    </Button>
  );
}
