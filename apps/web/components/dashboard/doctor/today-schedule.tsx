"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Video, FileText } from "lucide-react";

const mockSchedule = [
  {
    id: "1",
    patientName: "Ahmed Al-Rashid",
    parentName: "Sarah Al-Rashid",
    type: "Standard",
    time: "9:00 AM",
    duration: 30,
    status: "in-progress",
  },
  {
    id: "2",
    patientName: "Omar Khalil",
    parentName: "Fatima Khalil",
    type: "Quick",
    time: "10:00 AM",
    duration: 15,
    status: "upcoming",
  },
  {
    id: "3",
    patientName: "Noor Hassan",
    parentName: "Aisha Hassan",
    type: "Extended",
    time: "11:00 AM",
    duration: 45,
    status: "upcoming",
  },
  {
    id: "4",
    patientName: "Youssef Ibrahim",
    parentName: "Maryam Ibrahim",
    type: "Standard",
    time: "2:00 PM",
    duration: 30,
    status: "upcoming",
  },
];

export function TodaySchedule() {
  const { dictionary: t } = useI18n();

  const statusColors: Record<string, string> = {
    "in-progress": "bg-green-100 text-green-800",
    upcoming: "bg-blue-100 text-blue-800",
    completed: "bg-gray-100 text-gray-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {t.doctorDashboard.todaySchedule}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mockSchedule.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-border p-4"
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                {item.patientName}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.parentName}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.time}
                </span>
                <span>
                  {item.duration} {t.common.minutes}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {item.type}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[item.status]}`}
              >
                {item.status}
              </span>
              {item.status === "in-progress" && (
                <Button size="sm" className="gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  Join
                </Button>
              )}
              <Button size="sm" variant="ghost">
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
