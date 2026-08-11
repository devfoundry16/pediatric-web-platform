"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { doctorsApi, type Slot } from "@/lib/api/appointments";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import {
  DEFAULT_TIMEZONE,
  calendarDayInTimezone,
  formatLocalDateYMD,
  formatShortDateInTimezone,
  formatTimeInTimezone,
  formatTimezoneLabel,
  parseLocalYMD,
  todayInTimezone,
} from "@/lib/timezone";

interface StepSelectDateTimeProps {
  doctorId: string;
  typeId: string;
  selectedDate: string;
  selectedTime: string;
  /** Always receives the canonical doctor-local pair, never a displayed value. */
  onSelectSlot: (slot: { date: string; time: string; timezone: string }) => void;
  onSelectDate: (date: string) => void;
  onDoctorResolved: (doctorId: string) => void;
}

export function StepSelectDateTime({
  doctorId,
  typeId,
  selectedDate,
  selectedTime,
  onSelectSlot,
  onSelectDate,
  onDoctorResolved,
}: StepSelectDateTimeProps) {
  const { dictionary: t } = useI18n();
  const [date, setDate] = useState<Date | undefined>(
    selectedDate ? parseLocalYMD(selectedDate) : undefined
  );
  const [slots, setSlots] = useState<Slot[]>([]);
  const [doctorTimezone, setDoctorTimezone] = useState(DEFAULT_TIMEZONE);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [resolvedDoctorId, setResolvedDoctorId] = useState(doctorId);

  // Falls back to the doctor's zone until mounted, so the server prerender and
  // the first client render agree (see useViewerTimezone).
  const { timezone: viewerTimezone, setTimezone } = useViewerTimezone(doctorTimezone);

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
        const { slots: fetchedSlots, timezone } = await doctorsApi.getSlots(
          resolvedDoctorId,
          selectedDate,
          typeId
        );
        if (!cancelled) {
          setSlots(fetchedSlots);
          if (timezone) setDoctorTimezone(timezone);
        }
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

  // The calendar picks the DOCTOR's calendar day — that is what doctor_schedules,
  // doctor_holidays and the stored scheduled_date are all keyed on. So "today"
  // here is the doctor's today, not the visitor's: at UTC-8 the visitor's Aug 18
  // is still selectable hours after Aug 18 has ended in Dubai.
  const doctorToday = parseLocalYMD(todayInTimezone(doctorTimezone));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.selectDateTime}
      </h2>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-timezone" className="text-xs text-muted-foreground">
            {t.booking.timezoneSelectLabel}
          </Label>
          <TimezoneSelect
            id="booking-timezone"
            value={viewerTimezone}
            onChange={setTimezone}
            pinned={[doctorTimezone]}
            className="w-full sm:w-72"
          />
        </div>
        <TimezoneNotice timezone={viewerTimezone} className="sm:max-w-xs" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                if (d) onSelectDate(formatLocalDateYMD(d));
              }}
              disabled={(d) => (doctorToday ? d < doctorToday : false)}
              className="rounded-md"
            />
            {doctorTimezone !== viewerTimezone && (
              <p className="text-center text-xs text-muted-foreground">
                {t.booking.doctorTimezoneNote.replace(
                  "{timezone}",
                  formatTimezoneLabel(doctorTimezone)
                )}
              </p>
            )}
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
                {slots.map((slot) => {
                  const label = formatTimeInTimezone(slot.startsAt, viewerTimezone);
                  // A Dubai morning can be the previous evening in the Americas.
                  // Show the shifted day so the chip isn't quietly misleading.
                  const shiftedDay =
                    calendarDayInTimezone(slot.startsAt, viewerTimezone) !== slot.date
                      ? formatShortDateInTimezone(slot.startsAt, viewerTimezone)
                      : null;

                  return (
                    <Button
                      key={slot.startsAt}
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      size="sm"
                      // Always submit the canonical doctor-local pair — never
                      // anything derived from the label rendered above.
                      onClick={() =>
                        onSelectSlot({
                          date: slot.date,
                          time: slot.time,
                          timezone: doctorTimezone,
                        })
                      }
                      className={cn(
                        "h-auto flex-col gap-0 py-1.5 text-xs",
                        selectedTime === slot.time && "ring-1 ring-primary/30"
                      )}
                    >
                      <span>{label}</span>
                      {shiftedDay && (
                        <span className="text-[10px] opacity-70">{shiftedDay}</span>
                      )}
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
