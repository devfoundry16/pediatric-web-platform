"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Users } from "lucide-react";
import { doctorApi, type DoctorPatient } from "@/lib/api/doctor";

function calcAge(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yrs`;
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function RecentPatients() {
  const { dictionary: t } = useI18n();
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    doctorApi
      .getPatients()
      .then((data) => setPatients(data.slice(0, 4)))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t.doctorDashboard.patients}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t.doctorDashboard.noPatients}</p>
          </div>
        ) : (
          patients.map((patient) => {
            const child = patient.child;
            const name = child
              ? `${child.first_name} ${child.last_name}`
              : "Unknown";
            const age = child?.date_of_birth ? calcAge(child.date_of_birth) : "—";
            const abbr = child
              ? initials(child.first_name, child.last_name)
              : "?";

            return (
              <Link
                key={patient.child_id}
                href={`/dashboard/doctor/patients/${patient.child_id}`}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {abbr}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {age} &middot; {patient.guardian_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {patient.last_visit}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
