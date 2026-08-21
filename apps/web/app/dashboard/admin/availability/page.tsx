"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminDoctorRow, type DoctorScheduleSlot } from "@/lib/api/admin";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { useI18n } from "@/lib/i18n/i18n-context";

/** Weekday dictionary keys, indexed by day_of_week (0 = Sunday). */
const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Postgres returns TIME as "09:00:00"; <input type="time"> wants "09:00". */
const toHHMM = (time: string) => (time ?? "").slice(0, 5);

export default function AdminAvailabilityPage() {
  const { dictionary: t } = useI18n();
  // The data effects below must not re-run when the locale changes (that would
  // refetch and wipe in-progress edits), so they read their toast copy through
  // a ref that always holds the current dictionary.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [schedule, setSchedule] = useState<DoctorScheduleSlot[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; holiday_date: string; reason: string | null }[]>([]);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);

  // New holiday form
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayReason, setNewHolidayReason] = useState("");

  useEffect(() => {
    adminApi.listDoctors()
      .then(({ doctors: d }) => { setDoctors(d); if (d.length > 0) setSelectedDoctorId(d[0].id); })
      .catch(() => toast.error(tRef.current.admin.common.loadDoctorsError))
      .finally(() => setLoadingDoctors(false));
  }, []);

  useEffect(() => {
    if (!selectedDoctorId) return;

    // Clear the previous doctor's data immediately and ignore a response that
    // arrives after the selection changed — otherwise a slow request can paint
    // one doctor's hours (and timezone) under another's name, and saving then
    // writes them to the wrong doctor.
    let cancelled = false;
    setSchedule([]);
    setHolidays([]);
    setTimezone(DEFAULT_TIMEZONE);
    setLoadingData(true);

    Promise.all([
      adminApi.getDoctorSchedule(selectedDoctorId),
      adminApi.getDoctorHolidays(selectedDoctorId),
    ])
      .then(([{ schedule: s, timezone: tz }, { holidays: h }]) => {
        if (cancelled) return;
        setSchedule(s.map((slot) => ({
          ...slot,
          start_time: toHHMM(slot.start_time),
          end_time: toHHMM(slot.end_time),
        })));
        setHolidays(h);
        if (tz) setTimezone(tz);
      })
      .catch(() => { if (!cancelled) toast.error(tRef.current.admin.availability.loadError); })
      .finally(() => { if (!cancelled) setLoadingData(false); });

    return () => { cancelled = true; };
  }, [selectedDoctorId]);

  const handleSaveSchedule = async () => {
    if (!selectedDoctorId) return;

    if (schedule.some((s) => s.start_time >= s.end_time)) {
      toast.error(t.doctorDashboard.endBeforeStart);
      return;
    }

    setIsSaving(true);
    try {
      await adminApi.updateDoctorSchedule(selectedDoctorId, schedule.map(({ day_of_week, start_time, end_time, is_active }) => ({ day_of_week, start_time, end_time, is_active })));
      toast.success(t.doctorDashboard.scheduleSaved);
    } catch {
      toast.error(t.admin.availability.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimezoneChange = async (next: string) => {
    if (!selectedDoctorId) return;
    const previous = timezone;
    setTimezone(next);
    setIsSavingTimezone(true);
    try {
      await adminApi.updateDoctor(selectedDoctorId, { timezone: next });
      toast.success(t.doctorDashboard.timezoneSaved);
    } catch {
      setTimezone(previous);
      toast.error(t.admin.availability.timezoneError);
    } finally {
      setIsSavingTimezone(false);
    }
  };

  const addSlot = () => {
    setSchedule((prev) => [...prev, { day_of_week: 1, start_time: "09:00", end_time: "17:00", is_active: true }]);
  };

  const removeSlot = (idx: number) => {
    setSchedule((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx: number, field: keyof DoctorScheduleSlot, value: unknown) => {
    setSchedule((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addHoliday = async () => {
    if (!selectedDoctorId || !newHolidayDate) return;
    try {
      await adminApi.addDoctorHoliday(selectedDoctorId, newHolidayDate, newHolidayReason || undefined);
      const { holidays: h } = await adminApi.getDoctorHolidays(selectedDoctorId);
      setHolidays(h);
      setNewHolidayDate("");
      setNewHolidayReason("");
      toast.success(t.doctorDashboard.holidayAdded);
    } catch {
      toast.error(t.admin.availability.blockError);
    }
  };

  const deleteHoliday = async (id: string) => {
    try {
      await adminApi.deleteDoctorHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success(t.doctorDashboard.holidayRemoved);
    } catch {
      toast.error(t.admin.availability.unblockError);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.admin.availability.title}</h1>
        <p className="text-sm text-muted-foreground">{t.admin.availability.subtitle}</p>
      </div>

      {/* Doctor selector */}
      {loadingDoctors ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={t.admin.availability.selectDoctor} />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedDoctorId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t.doctorDashboard.workingHours}</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addSlot}>
                <Plus className="h-4 w-4" /> {t.admin.availability.addSlot}
              </Button>
            </CardHeader>
            <CardContent>
              {/* Saved on change, separately from the hours below — those are
                  deleted and reinserted wholesale on save. */}
              <div className="mb-4 flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-3">
                <label htmlFor="doctor-timezone" className="text-sm font-medium text-foreground">
                  {t.doctorDashboard.timezoneLabel}
                </label>
                <TimezoneSelect
                  id="doctor-timezone"
                  value={timezone}
                  onChange={handleTimezoneChange}
                  disabled={loadingData || isSavingTimezone}
                />
                <p className="text-xs text-muted-foreground">
                  {t.admin.availability.timezoneHint}
                </p>
              </div>

              {loadingData ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : schedule.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.admin.availability.noSlots}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {schedule.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-wrap">
                      <Select
                        value={String(slot.day_of_week)}
                        onValueChange={(v) => updateSlot(idx, "day_of_week", Number(v))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_KEYS.map((key, i) => (
                            <SelectItem key={i} value={String(i)}>{t.doctorDashboard[key]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => updateSlot(idx, "start_time", e.target.value)}
                        className="w-28"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) => updateSlot(idx, "end_time", e.target.value)}
                        className="w-28"
                      />
                      <button
                        onClick={() => updateSlot(idx, "is_active", !slot.is_active)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${slot.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {slot.is_active ? t.admin.common.active : t.admin.common.off}
                      </button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeSlot(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button className="mt-4 gap-2" onClick={handleSaveSchedule} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t.admin.availability.saveSchedule}
              </Button>
            </CardContent>
          </Card>

          {/* Holidays / blocked dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.admin.availability.holidaysTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Add new */}
              <div className="flex flex-wrap gap-2">
                <Input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  placeholder={t.doctorDashboard.holidayReason}
                  value={newHolidayReason}
                  onChange={(e) => setNewHolidayReason(e.target.value)}
                  className="flex-1 min-w-32"
                />
                <Button size="sm" className="gap-1.5" onClick={addHoliday} disabled={!newHolidayDate}>
                  <Plus className="h-4 w-4" /> {t.admin.availability.add}
                </Button>
              </div>

              {loadingData ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.admin.availability.noBlockedDates}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {holidays.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <div>
                        <span className="font-medium text-foreground">{h.holiday_date}</span>
                        {h.reason && <span className="ml-2 text-sm text-muted-foreground">{h.reason}</span>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteHoliday(h.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
