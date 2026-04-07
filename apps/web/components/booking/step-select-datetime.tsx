"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { doctorsApi } from "@/lib/api/appointments";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { formatLocalDateYMD, parseLocalYMD } from "@/lib/timezone";

interface StepSelectDateTimeProps {
  doctorId: string;
  typeId: string;
  selectedDate: string;
  selectedTime: string;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
  onDoctorResolved: (doctorId: string) => void;
}

export function StepSelectDateTime({
  doctorId,
  typeId,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  onDoctorResolved,
}: StepSelectDateTimeProps) {
  const { dictionary: t } = useI18n();
  const [date, setDate] = useState<Date | undefined>(
    selectedDate ? parseLocalYMD(selectedDate) : undefined
  );
  const [slots, setSlots] = useState<string[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [resolvedDoctorId, setResolvedDoctorId] = useState(doctorId);

  // Resolve a doctor to use for slot fetching if none provided yet
  useEffect(() => {
    if (resolvedDoctorId || !typeId) return;
    doctorsApi
      .list()
      .then((doctors) => {
        if (doctors.length > 0) {
          setResolvedDoctorId(doctors[0].id);
          onDoctorResolved(doctors[0].id);
        }
      })
      .catch(() => {});
  }, [resolvedDoctorId, typeId, onDoctorResolved]);

  const canFetchSlots = Boolean(
    selectedDate && resolvedDoctorId && typeId
  );

  // Fetch slots when date / doctor / type are ready. State updates run after a microtask so the effect
  // does not synchronously cascade renders (see react.dev/you-might-not-need-an-effect).
  useEffect(() => {
    if (!canFetchSlots) return;

    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setIsSlotsLoading(true);
      setSlotsError(null);
      try {
        const fetchedSlots = await doctorsApi.getSlots(
          resolvedDoctorId,
          selectedDate,
          typeId
        );
        if (!cancelled) setSlots(fetchedSlots);
      } catch {
        if (!cancelled) setSlotsError(t.booking.slotsLoadError);
      } finally {
        if (!cancelled) setIsSlotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canFetchSlots, selectedDate, resolvedDoctorId, typeId, t.booking.slotsLoadError]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.selectDateTime}
      </h2>
      <TimezoneNotice />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-center p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                onSelectTime("");
                if (d) onSelectDate(formatLocalDateYMD(d));
              }}
              disabled={(d) => d < today}
              className="rounded-md"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t.booking.availableSlots}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground">
                {t.booking.selectDateForSlots}
              </p>
            ) : isSlotsLoading ? (
              <div className="flex flex-wrap gap-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-20 rounded-md" />
                ))}
              </div>
            ) : slotsError ? (
              <p className="text-sm text-destructive">{slotsError}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.booking.noSlotsTryAnother}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <Button
                    key={slot}
                    variant={selectedTime === slot ? "default" : "outline"}
                    size="sm"
                    onClick={() => onSelectTime(slot)}
                    className={cn("text-xs", selectedTime === slot && "ring-1 ring-primary/30")}
                  >
                    {slot}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
