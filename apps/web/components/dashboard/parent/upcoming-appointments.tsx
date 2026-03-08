"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Video, Plus } from "lucide-react";

const mockAppointments = [
  {
    id: "1",
    childName: "Ahmed",
    type: "Standard Consultation",
    date: "2026-02-15",
    time: "10:00 AM",
    status: "confirmed",
    duration: 30,
  },
  {
    id: "2",
    childName: "Layla",
    type: "Quick Consultation",
    date: "2026-02-18",
    time: "2:30 PM",
    status: "pending",
    duration: 15,
  },
];

export function UpcomingAppointments() {
  const { dictionary: t } = useI18n();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {t.parentDashboard.upcomingAppointments}
        </CardTitle>
        <Link href="/booking">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t.parentDashboard.bookAppointment}
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mockAppointments.map((appt) => (
          <div
            key={appt.id}
            className="flex items-center justify-between rounded-lg border border-border p-4"
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                {appt.childName} - {appt.type}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {appt.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {appt.time}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={appt.status === "confirmed" ? "default" : "secondary"}
              >
                {appt.status}
              </Badge>
              {appt.status === "confirmed" && (
                <Button size="sm" variant="outline" className="gap-1.5 bg-transparent">
                  <Video className="h-3.5 w-3.5" />
                  Join
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
