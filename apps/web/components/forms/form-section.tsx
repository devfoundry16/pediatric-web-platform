"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BadgeVariant = "optional" | "recommended" | "required" | "none";

interface FormSectionProps {
  title: string;
  description?: string;
  badge?: BadgeVariant;
  badgeLabel?: string;
  className?: string;
  children: React.ReactNode;
}

const badgeStyles: Record<Exclude<BadgeVariant, "none">, string> = {
  optional:
    "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
  recommended:
    "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
  required:
    "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive",
};

export function FormSection({
  title,
  description,
  badge = "none",
  badgeLabel,
  className,
  children,
}: FormSectionProps) {
  const defaultLabels: Record<Exclude<BadgeVariant, "none">, string> = {
    optional: "Optional",
    recommended: "Recommended",
    required: "Required",
  };

  const showBadge = badge !== "none";
  const label = badgeLabel ?? (showBadge ? defaultLabels[badge] : "");

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {showBadge && (
            <span className={badgeStyles[badge]}>{label}</span>
          )}
        </div>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}
