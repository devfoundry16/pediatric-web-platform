"use client";

import { useEffect, useState } from "react";
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
import { adminApi, type AdminDoctorRow, type DoctorScheduleSlot } from "@/lib/api/admin";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminAvailabilityPage() {
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [schedule, setSchedule] = useState<DoctorScheduleSlot[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; holiday_date: string; reason: string | null }[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New holiday form
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayReason, setNewHolidayReason] = useState("");

  useEffect(() => {
    adminApi.listDoctors()
      .then(({ doctors: d }) => { setDoctors(d); if (d.length > 0) setSelectedDoctorId(d[0].id); })
      .finally(() => setLoadingDoctors(false));
  }, []);

  useEffect(() => {
    if (!selectedDoctorId) return;
    setLoadingData(true);
    Promise.all([
      adminApi.getDoctorSchedule(selectedDoctorId),
      adminApi.getDoctorHolidays(selectedDoctorId),
    ])
      .then(([{ schedule: s }, { holidays: h }]) => {
        setSchedule(s);
        setHolidays(h);
      })
      .finally(() => setLoadingData(false));
  }, [selectedDoctorId]);

  const handleSaveSchedule = async () => {
    if (!selectedDoctorId) return;
    setIsSaving(true);
    try {
      await adminApi.updateDoctorSchedule(selectedDoctorId, schedule.map(({ day_of_week, start_time, end_time, is_active }) => ({ day_of_week, start_time, end_time, is_active })));
    } finally {
      setIsSaving(false);
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
    await adminApi.addDoctorHoliday(selectedDoctorId, newHolidayDate, newHolidayReason || undefined);
    const { holidays: h } = await adminApi.getDoctorHolidays(selectedDoctorId);
    setHolidays(h);
    setNewHolidayDate("");
    setNewHolidayReason("");
  };

  const deleteHoliday = async (id: string) => {
    await adminApi.deleteDoctorHoliday(id);
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Doctor Availability</h1>
        <p className="text-sm text-muted-foreground">Manage working hours, slots, and blocked dates</p>
      </div>

      {/* Doctor selector */}
      {loadingDoctors ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select doctor" />
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
              <CardTitle className="text-base">Working Hours</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addSlot}>
                <Plus className="h-4 w-4" /> Add slot
              </Button>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : schedule.length === 0 ? (
                <p className="text-sm text-muted-foreground">No working hours set. Add a slot above.</p>
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
                          {DAYS.map((d, i) => (
                            <SelectItem key={i} value={String(i)}>{d}</SelectItem>
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
                        {slot.is_active ? "Active" : "Off"}
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
                Save schedule
              </Button>
            </CardContent>
          </Card>

          {/* Holidays / blocked dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Blocked Dates & Holidays</CardTitle>
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
                  placeholder="Reason (optional)"
                  value={newHolidayReason}
                  onChange={(e) => setNewHolidayReason(e.target.value)}
                  className="flex-1 min-w-32"
                />
                <Button size="sm" className="gap-1.5" onClick={addHoliday} disabled={!newHolidayDate}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>

              {loadingData ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blocked dates.</p>
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
