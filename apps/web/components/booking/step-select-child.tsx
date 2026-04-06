"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Check, UserPlus } from "lucide-react";
import { childrenApi } from "@/lib/api/children";
import type { ChildProfile } from "@/types/child";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface StepSelectChildProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function StepSelectChild({ selected, onSelect }: StepSelectChildProps) {
  const { dictionary: t, locale } = useI18n();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    childrenApi
      .list()
      .then(setChildren)
      .catch(() => setError(t.booking.childLoadError))
      .finally(() => setIsLoading(false));
  }, [locale]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t.booking.selectChild}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t.booking.selectChild}
        </h2>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <h2 className="text-lg font-semibold text-foreground">
          {t.booking.selectChild}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.booking.noChildrenYet}
        </p>
        <Link href="/dashboard/parent/children/add">
          <Button variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t.parentDashboard.addChild}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.selectChild}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children.map((child) => {
          const firstName = child.personalInfo.firstName;
          const lastName = child.personalInfo.lastName;
          const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
          const dob = new Date(child.personalInfo.dateOfBirth);
          const ageYears = Math.floor(
            (new Date().getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
          );
          const monthCount = Math.floor(
            (new Date().getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30)
          );
          const ageLabel =
            ageYears < 1
              ? `${monthCount} ${t.booking.unitMonths}`
              : ageYears === 1
                ? `1 ${t.booking.unitYear}`
                : `${ageYears} ${t.booking.unitYears}`;

          return (
            <Card
              key={child.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selected === child.id
                  ? "border-primary ring-1 ring-primary/20"
                  : "border-border"
              )}
              onClick={() => onSelect(child.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {firstName} {lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{ageLabel}</p>
                </div>
                {selected === child.id && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
