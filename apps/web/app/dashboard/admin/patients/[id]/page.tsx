"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  User,
  FileText,
  Paperclip,
  CalendarDays,
} from "lucide-react";
import { adminApi, type ChildProfile, type AdminUser } from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone } from "@/lib/timezone";
import { getAppointmentStatusLabel } from "@/lib/i18n/appointment-status";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";
import { getGenderLabel } from "@/lib/i18n/gender";
import { getRecordTypeLabel } from "@/lib/i18n/record-type";
import type { AppointmentStatus } from "@/types/appointment";

function calcAge(dob: string, monthsTemplate: string, yearsTemplate: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (totalMonths < 24) return monthsTemplate.replace("{count}", String(totalMonths));
  return yearsTemplate.replace("{count}", String(Math.floor(totalMonths / 12)));
}

interface MedicalRecord {
  id: string;
  record_type: string;
  title: string;
  created_at: string;
  doctors: { full_name: string } | null;
}

interface MedicalFile {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  signed_url: string | null;
  file_size_bytes: number;
  created_at: string;
}

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  consultation_type: string;
}

export default function AdminPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone } = useViewerTimezone();
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [parent, setParent] = useState<AdminUser | null>(null);
  const [files, setFiles] = useState<MedicalFile[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    adminApi.getPatient(id)
      .then(({ child: c, parent: p, files: f, records: r, appointments: a }) => {
        setChild(c);
        setParent(p as AdminUser);
        setFiles(f as MedicalFile[]);
        setRecords(r as MedicalRecord[]);
        setAppointments(a as Appointment[]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/dashboard/admin/patients">
            <ChevronLeft className="h-4 w-4" /> {t.admin.nav.patients}
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !child ? (
        <p className="text-sm text-destructive">{t.admin.patients.notFound}</p>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-foreground">{child.first_name} {child.last_name}</h1>

          {/* Child + Parent info */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" /> {t.admin.patients.childInfo}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <Row label={t.admin.common.fullName} value={`${child.first_name} ${child.last_name}`} />
                <Row label={t.admin.patients.dateOfBirth} value={child.date_of_birth as string} />
                <Row label={t.admin.patients.age} value={child.date_of_birth ? calcAge(child.date_of_birth as string, t.admin.patients.ageMonths, t.admin.patients.ageYears) : "—"} />
                <Row label={t.patient.gender} value={getGenderLabel(t, (child.gender as string) ?? null)} />
                {(child.blood_type as string) && <Row label={t.admin.patients.bloodType} value={child.blood_type as string} />}
                {(child.allergies as string) && <Row label={t.admin.patients.allergies} value={child.allergies as string} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" /> {t.admin.patients.parentInfo}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <Row label={t.common.name} value={parent?.full_name ?? "—"} />
                <Row label={t.common.email} value={parent?.email ?? "—"} />
                <Row label={t.common.phone} value={parent?.phone ?? "—"} />
                <Row label={t.common.status} value={
                  <Badge variant="outline" className={parent?.is_active ? "text-green-700" : "text-red-600"}>
                    {parent?.is_active ? t.admin.common.active : t.admin.common.inactive}
                  </Badge>
                } />
              </CardContent>
            </Card>
          </div>

          {/* Recent appointments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" /> {t.admin.patients.recentAppointments}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.admin.patients.noAppointments}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{a.scheduled_date} {a.scheduled_time}</span>
                      <span className="capitalize text-muted-foreground">{getConsultationTypeLabel(t, a.consultation_type)}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{getAppointmentStatusLabel(t, a.status as AppointmentStatus)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Medical records */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> {t.medicalRecords.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.admin.patients.noRecords}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {records.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-foreground">{r.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground capitalize">{getRecordTypeLabel(t, r.record_type)}</span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{r.doctors?.full_name ?? "—"}</div>
                        <div>{formatDateInTimezone(r.created_at, timezone, dateLocale)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Uploaded files */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4" /> {t.admin.patients.uploadedFiles}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.admin.patients.noFiles}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <a href={f.signed_url ?? "#"} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline truncate max-w-xs">
                        {f.file_name}
                      </a>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{f.file_type}</div>
                        <div>{f.file_size_bytes ? t.admin.patients.fileSizeKb.replace("{size}", String(Math.round(f.file_size_bytes / 1024))) : ""}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}
