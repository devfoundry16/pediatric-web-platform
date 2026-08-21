"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Search } from "lucide-react";
import { doctorApi, type DoctorPatient } from "@/lib/api/doctor";
import { formatDateDisplayDubai } from "@/lib/timezone";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcAge(t: Dictionary, dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (months < 24)
    return t.doctorDashboard.ageMonthsShort.replace("{count}", String(months));
  return t.doctorDashboard.ageYearsShort.replace(
    "{count}",
    String(Math.floor(months / 12))
  );
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorPatientsPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    doctorApi
      .getPatients()
      .then(setPatients)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((p) => {
    if (!search.trim()) return true;
    const name = p.child
      ? `${p.child.first_name} ${p.child.last_name}`.toLowerCase()
      : "";
    return name.includes(search.toLowerCase());
  });

  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">
            {t.doctorDashboard.patients}
          </h1>
          <p className="text-muted-foreground">
            {!loading &&
              !error &&
              t.doctorDashboard.patientsCount.replace(
                "{count}",
                String(patients.length)
              )}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t.common.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table header */}
        {!loading && !error && filtered.length > 0 && (
          <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-4 px-4 text-xs font-medium uppercase text-muted-foreground sm:grid">
            <span>{t.common.name}</span>
            <span>{t.doctorDashboard.guardianName}</span>
            <span>{t.doctorDashboard.lastVisit}</span>
            <span>{t.doctorDashboard.totalAppointments}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {t.doctorDashboard.loadError}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14">
              <Users className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {search ? t.common.noResults : t.doctorDashboard.noPatients}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((patient) => {
              const child = patient.child;
              const name = child
                ? `${child.first_name} ${child.last_name}`
                : t.doctorDashboard.unknownPatient;
              const age = child?.date_of_birth
                ? calcAge(t, child.date_of_birth)
                : t.appointments.dash;
              const abbr = child
                ? initials(child.first_name, child.last_name)
                : "?";

              return (
                <Card
                  key={patient.child_id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Child info */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {abbr}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">{age}</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground sm:gap-8">
                      <div>
                        <p className="text-xs uppercase tracking-wide">
                          {t.doctorDashboard.guardianName}
                        </p>
                        <p className="font-medium text-foreground">
                          {patient.guardian_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide">
                          {t.doctorDashboard.lastVisit}
                        </p>
                        <p className="font-medium text-foreground">
                          {formatDateDisplayDubai(patient.last_visit, dateLocale)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide">
                          {t.doctorDashboard.totalAppointments}
                        </p>
                        <p className="font-medium text-foreground">
                          {patient.total_appointments}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
