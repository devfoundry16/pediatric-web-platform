"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/i18n-context";

export interface StepItem {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: StepItem[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  className,
}: StepIndicatorProps) {
  const { dictionary: t } = useI18n();
  return (
    <nav aria-label={t.common.progress} className={cn("w-full", className)}>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <li
              key={step.id}
              className="flex flex-1 items-center gap-2 sm:flex-col sm:items-start sm:gap-1.5"
            >
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isComplete &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      !isComplete &&
                      "border-primary text-primary",
                    !isCurrent &&
                      !isComplete &&
                      "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium sm:hidden",
                    isCurrent && "text-foreground",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  isCurrent && "text-foreground",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 ? (
                <div
                  className="mx-2 hidden h-px flex-1 bg-border sm:block"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
