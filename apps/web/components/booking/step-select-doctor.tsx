"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { doctorsApi } from "@/lib/api/appointments";
import type { Doctor } from "@/types/appointment";

interface StepSelectDoctorProps {
  selected: string;
  onSelect: (id: string) => void;
}

function initialsOf(name: string): string {
  return name
    .replace(/^Dr\.?\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function StepSelectDoctor({ selected, onSelect }: StepSelectDoctorProps) {
  const { dictionary: t, locale } = useI18n();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    doctorsApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setDoctors(list);
        // With a single doctor, pre-select so the parent can proceed directly.
        if (list.length === 1 && !selected) {
          onSelect(list[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t.booking.doctorLoadError);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch on locale change to mirror the other booking steps; `selected`
    // is intentionally omitted so pre-selection only runs on (re)load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t.booking.selectDoctor}
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
          {t.booking.selectDoctor}
        </h2>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <h2 className="text-lg font-semibold text-foreground">
          {t.booking.selectDoctor}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.booking.noDoctorsAvailable}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.selectDoctor}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {doctors.map((doctor) => (
          <Card
            key={doctor.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selected === doctor.id
                ? "border-primary ring-1 ring-primary/20"
                : "border-border"
            )}
            onClick={() => onSelect(doctor.id)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                {doctor.avatar_url && (
                  <AvatarImage src={doctor.avatar_url} alt={doctor.full_name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initialsOf(doctor.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {doctor.full_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {doctor.specialty}
                </p>
              </div>
              {selected === doctor.id && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
