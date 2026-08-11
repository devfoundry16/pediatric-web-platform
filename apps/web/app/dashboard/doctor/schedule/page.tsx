"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarX2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { doctorApi, type ScheduleRow, type DoctorHoliday } from "@/lib/api/doctor";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import {
  DEFAULT_TIMEZONE,
  formatHolidayDateDubai,
  todayInTimezone,
} from "@/lib/timezone";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayState {
  day_of_week: number;
  active: boolean;
  start_time: string;
  end_time: string;
}

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

function buildDefaultDays(): DayState[] {
  return DAY_KEYS.map((_, i) => ({
    day_of_week: i,
    active: i >= 0 && i <= 4, // Sun–Thu active by default
    start_time: DEFAULT_START,
    end_time: DEFAULT_END,
  }));
}

function scheduleRowsToDayStates(rows: ScheduleRow[]): DayState[] {
  const map = new Map(rows.map((r) => [r.day_of_week, r]));
  return DAY_KEYS.map((_, i) => {
    const row = map.get(i);
    return {
      day_of_week: i,
      active: row ? (row.is_active ?? true) : false,
      start_time: row ? row.start_time.slice(0, 5) : DEFAULT_START,
      end_time: row ? row.end_time.slice(0, 5) : DEFAULT_END,
    };
  });
}

// ─── Working hours section ────────────────────────────────────────────────────

function WorkingHoursCard({
  days,
  timezone,
  loading,
  saving,
  savingTimezone,
  onChange,
  onTimezoneChange,
  onSave,
}: {
  days: DayState[];
  timezone: string;
  loading: boolean;
  saving: boolean;
  savingTimezone: boolean;
  onChange: (updated: DayState[]) => void;
  onTimezoneChange: (timezone: string) => void;
  onSave: () => void;
}) {
  const { dictionary: t } = useI18n();
  const d = t.doctorDashboard;

  function setDay(index: number, patch: Partial<DayState>) {
    const updated = days.map((day, i) =>
      i === index ? { ...day, ...patch } : day
    );
    onChange(updated);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.workingHours}</CardTitle>
        <CardDescription>{d.workingHoursDesc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))
        ) : (
          <>
            {/* Saves on its own — the hours below are replaced wholesale on
                save, and the zone shouldn't ride along with that. */}
            <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-4">
              <Label htmlFor="schedule-timezone">{d.timezoneLabel}</Label>
              <TimezoneSelect
                id="schedule-timezone"
                value={timezone}
                onChange={onTimezoneChange}
                disabled={savingTimezone}
              />
              <p className="text-xs text-muted-foreground">{d.timezoneDesc}</p>
            </div>

            {days.map((day, index) => (
              <div
                key={day.day_of_week}
                className={`flex flex-wrap items-center gap-4 rounded-lg border p-4 transition-colors ${
                  day.active ? "border-border bg-background" : "border-border/50 bg-muted/30"
                }`}
              >
                {/* Day name + toggle */}
                <div className="flex w-32 shrink-0 items-center gap-3">
                  <Switch
                    id={`day-${index}`}
                    checked={day.active}
                    onCheckedChange={(checked) =>
                      setDay(index, { active: checked })
                    }
                  />
                  <Label
                    htmlFor={`day-${index}`}
                    className={`text-sm font-medium ${
                      day.active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {d[DAY_KEYS[day.day_of_week]]}
                  </Label>
                </div>

                {/* Time range */}
                {day.active ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {d.from}
                      </span>
                      <Input
                        type="time"
                        value={day.start_time}
                        onChange={(e) =>
                          setDay(index, { start_time: e.target.value })
                        }
                        className="w-32"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {d.to}
                      </span>
                      <Input
                        type="time"
                        value={day.end_time}
                        onChange={(e) =>
                          setDay(index, { end_time: e.target.value })
                        }
                        className="w-32"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {d.dayOff}
                  </span>
                )}
              </div>
            ))}

            <Button
              onClick={onSave}
              disabled={saving}
              className="mt-2 self-start"
            >
              {saving ? t.common.loading : d.saveSchedule}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Holidays section ─────────────────────────────────────────────────────────

function HolidaysCard({
  holidays,
  timezone,
  loading,
  onAdd,
  onDelete,
}: {
  holidays: DoctorHoliday[];
  timezone: string;
  loading: boolean;
  onAdd: (date: string, reason: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { dictionary: t } = useI18n();
  const d = t.doctorDashboard;

  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // The doctor's own calendar day, not the browser's and not UTC.
  // toISOString() here would shift the day for any zone ahead of UTC.
  const today = todayInTimezone(timezone);

  async function handleAdd() {
    if (!date) return;
    setAdding(true);
    try {
      await onAdd(date, reason);
      setDate("");
      setReason("");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.holidaysTitle}</CardTitle>
        <CardDescription>{d.holidaysDesc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Add form */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="holiday-date">{d.holidayDate}</Label>
            <Input
              id="holiday-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="holiday-reason">{d.holidayReason}</Label>
            <Textarea
              id="holiday-reason"
              rows={1}
              placeholder={d.holidayReasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[38px] resize-none"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={!date || adding}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {d.addHoliday}
          </Button>
        </div>

        {/* List */}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))
        ) : holidays.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <CalendarX2 className="h-8 w-8 opacity-40" />
            <p className="text-sm">{d.noHolidays}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {holidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {formatHolidayDateDubai(h.holiday_date)}
                  </p>
                  {h.reason && (
                    <p className="text-xs text-muted-foreground">{h.reason}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={deletingId === h.id}
                  onClick={() => handleDelete(h.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorSchedulePage() {
  const { dictionary: t } = useI18n();
  const d = t.doctorDashboard;

  const [days, setDays] = useState<DayState[]>(buildDefaultDays());
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [timezoneSaving, setTimezoneSaving] = useState(false);

  const [holidays, setHolidays] = useState<DoctorHoliday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);

  const loadSchedule = useCallback(async () => {
    try {
      const { schedule, timezone: tz } = await doctorApi.getSchedule();
      setDays(scheduleRowsToDayStates(schedule));
      if (tz) setTimezone(tz);
    } catch {
      toast.error(d.loadError);
    } finally {
      setScheduleLoading(false);
    }
  }, [d.loadError]);

  const loadHolidays = useCallback(async () => {
    try {
      const data = await doctorApi.getHolidays();
      setHolidays(data);
    } catch {
      // silently ignore — error shown on add/delete
    } finally {
      setHolidaysLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
    loadHolidays();
  }, [loadSchedule, loadHolidays]);

  async function saveSchedule() {
    const invalid = days.find((day) => day.active && day.start_time >= day.end_time);
    if (invalid) {
      toast.error(d.endBeforeStart);
      return;
    }

    setScheduleSaving(true);
    try {
      const rows: ScheduleRow[] = days
        .filter((d) => d.active)
        .map((d) => ({
          day_of_week: d.day_of_week,
          start_time: d.start_time,
          end_time: d.end_time,
          is_active: true,
        }));
      await doctorApi.updateSchedule(rows);
      toast.success(d.scheduleSaved);
    } catch {
      toast.error(d.loadError);
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveTimezone(next: string) {
    const previous = timezone;
    setTimezone(next);
    setTimezoneSaving(true);
    try {
      await doctorApi.updateProfile({ timezone: next });
      toast.success(d.timezoneSaved);
    } catch {
      setTimezone(previous);
      toast.error(d.loadError);
    } finally {
      setTimezoneSaving(false);
    }
  }

  async function addHoliday(date: string, reason: string) {
    try {
      const h = await doctorApi.addHoliday(date, reason || undefined);
      setHolidays((prev) =>
        [...prev, h].sort((a, b) =>
          a.holiday_date.localeCompare(b.holiday_date)
        )
      );
      toast.success(d.holidayAdded);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? d.loadError;
      toast.error(
        msg.includes("already") ? d.holidayDuplicate : msg
      );
      throw err;
    }
  }

  async function deleteHoliday(id: string) {
    try {
      await doctorApi.deleteHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success(d.holidayRemoved);
    } catch {
      toast.error(d.loadError);
    }
  }

  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {d.scheduleTitle}
          </h1>
        </div>

        <WorkingHoursCard
          days={days}
          timezone={timezone}
          loading={scheduleLoading}
          saving={scheduleSaving}
          savingTimezone={timezoneSaving}
          onChange={setDays}
          onTimezoneChange={saveTimezone}
          onSave={saveSchedule}
        />

        <HolidaysCard
          holidays={holidays}
          timezone={timezone}
          loading={holidaysLoading}
          onAdd={addHoliday}
          onDelete={deleteHoliday}
        />
      </div>
    </DashboardLayout>
  );
}
