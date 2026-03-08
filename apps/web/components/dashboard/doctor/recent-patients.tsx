"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";

const mockPatients = [
  {
    id: "1",
    name: "Ahmed Al-Rashid",
    age: "4 years",
    lastVisit: "2026-02-10",
    condition: "Regular check-up",
    initials: "AR",
  },
  {
    id: "2",
    name: "Omar Khalil",
    age: "6 months",
    lastVisit: "2026-02-08",
    condition: "Vaccination",
    initials: "OK",
  },
  {
    id: "3",
    name: "Noor Hassan",
    age: "2 years",
    lastVisit: "2026-02-05",
    condition: "Fever follow-up",
    initials: "NH",
  },
  {
    id: "4",
    name: "Youssef Ibrahim",
    age: "3 years",
    lastVisit: "2026-02-03",
    condition: "Allergy assessment",
    initials: "YI",
  },
];

export function RecentPatients() {
  const { dictionary: t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {t.doctorDashboard.patients}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mockPatients.map((patient) => (
          <Link
            key={patient.id}
            href={`/dashboard/doctor/patients/${patient.id}`}
            className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">
                  {patient.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {patient.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {patient.age} &middot; {patient.condition}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {patient.lastVisit}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
