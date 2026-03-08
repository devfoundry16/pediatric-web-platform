"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface StepSelectDateTimeProps {
  selectedDate: string;
  selectedTime: string;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
}

const timeSlots = {
  morning: ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"],
  afternoon: ["1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM"],
  evening: ["5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM"],
};

export function StepSelectDateTime({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: StepSelectDateTimeProps) {
  const { dictionary: t } = useI18n();
  const [date, setDate] = useState<Date | undefined>(
    selectedDate ? new Date(selectedDate) : undefined
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.selectDateTime}
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-center p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                if (d) onSelectDate(d.toISOString().split("T")[0]);
              }}
              disabled={(d) => d < new Date()}
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
          <CardContent className="flex flex-col gap-4">
            {Object.entries(timeSlots).map(([period, slots]) => (
              <div key={period} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground capitalize">
                  {t.booking[period as keyof typeof t.booking] || period}
                </p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <Button
                      key={slot}
                      variant={selectedTime === slot ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelectTime(slot)}
                      className="text-xs"
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
