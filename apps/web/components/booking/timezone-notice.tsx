"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { cn } from "@/lib/utils";

interface TimezoneNoticeProps {
  variant?: "default" | "compact";
  className?: string;
}

export function TimezoneNotice({ variant = "default", className }: TimezoneNoticeProps) {
  const { dictionary: t } = useI18n();

  if (variant === "compact") {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Globe className="h-3 w-3 shrink-0" aria-hidden />
        <span>{t.booking.timezoneShort}</span>
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
      <span>{t.booking.timezoneHint}</span>
    </p>
  );
}
