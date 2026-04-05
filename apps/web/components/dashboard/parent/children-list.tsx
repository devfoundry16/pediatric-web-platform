"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { differenceInMonths, differenceInYears, parseISO } from "date-fns";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronRight } from "lucide-react";
import { childrenApi } from "@/lib/api/children";
import type { ChildProfile } from "@/types/child";

function formatAge(dob: string): string {
  const d = parseISO(dob);
  const now = new Date();
  const years = differenceInYears(now, d);
  if (years >= 1) {
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  const months = differenceInMonths(now, d);
  return `${Math.max(0, months)} ${months === 1 ? "month" : "months"}`;
}

function initials(profile: ChildProfile): string {
  const f = profile.personalInfo.firstName?.[0] ?? "";
  const l = profile.personalInfo.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function genderLabel(
  profile: ChildProfile,
  t: { male: string; female: string; preferNotToSay: string }
): string {
  const g = profile.personalInfo.gender;
  if (g === "male") return t.male;
  if (g === "female") return t.female;
  return t.preferNotToSay;
}

interface ChildrenListProps {
  /** Card title override */
  title?: string;
}

export function ChildrenList({ title }: ChildrenListProps) {
  const { dictionary: t } = useI18n();
  const [children, setChildren] = useState<ChildProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    childrenApi
      .list()
      .then((data) => {
        if (!cancelled) {
          setChildren(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChildren([]);
          setError(t.childForm.listError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cardTitle = title ?? t.parentDashboard.myChildren;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">{cardTitle}</CardTitle>
        <Link href="/dashboard/parent/children/add">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 bg-transparent"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.parentDashboard.addChild}
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {children === null ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : children.length === 0 && !error ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t.childForm.noChildren}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.childForm.noChildrenHint}
            </p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/parent/children/add">
                {t.parentDashboard.addChild}
              </Link>
            </Button>
          </div>
        ) : (
          children.map((child) => {
            const name = `${child.personalInfo.firstName} ${child.personalInfo.lastName}`;
            const age = formatAge(child.personalInfo.dateOfBirth);
            const gender = genderLabel(child, t.patient);
            const allergyNote =
              child.healthBackground.allergiesPresent &&
              child.healthBackground.allergiesDetails
                ? child.healthBackground.allergiesDetails
                : null;

            return (
              <Link
                key={child.id}
                href={`/dashboard/parent/children/${child.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials(child)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {age} &middot; {gender}
                    </p>
                    {allergyNote ? (
                      <Badge variant="secondary" className="mt-1 max-w-full truncate text-xs">
                        {t.patient.allergies}: {allergyNote}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
