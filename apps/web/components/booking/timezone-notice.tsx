"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { cn } from "@/lib/utils";
import { DEFAULT_TIMEZONE, formatTimezoneLabel } from "@/lib/timezone";

interface TimezoneNoticeProps {
  /**
   * The zone the times beside this notice are displayed in. Required in
   * practice — it used to be hardcoded to "GST (UTC+4)", which was simply wrong
   * for anyone outside the UAE.
   */
  timezone?: string;
  variant?: "default" | "compact";
  className?: string;
}

export function TimezoneNotice({
  timezone = DEFAULT_TIMEZONE,
  variant = "default",
  className,
}: TimezoneNoticeProps) {
  const { dictionary: t } = useI18n();
  const label = formatTimezoneLabel(timezone);

  if (variant === "compact") {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Globe className="h-3 w-3 shrink-0" aria-hidden />
        <span>{label}</span>
      </p>
    );
  }

  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground",
        className
      )}
    >
      <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{t.booking.timezoneHint.replace("{timezone}", label)}</span>
    </p>
  );
}
