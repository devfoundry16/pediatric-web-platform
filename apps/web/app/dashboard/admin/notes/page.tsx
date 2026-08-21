"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye } from "lucide-react";
import { adminApi, type MedicalNote, type AdminDoctorRow } from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";
import { getRecordTypeLabel } from "@/lib/i18n/record-type";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone } from "@/lib/timezone";

export default function AdminNotesPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone } = useViewerTimezone();
  const [notes, setNotes] = useState<MedicalNote[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterDoctor, setFilterDoctor] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;
  const [viewNote, setViewNote] = useState<MedicalNote | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.listNotes({ doctorId: filterDoctor || undefined, page, limit: LIMIT }),
      doctors.length === 0 ? adminApi.listDoctors() : Promise.resolve({ doctors }),
    ])
      .then(([{ notes: n, total: t }, { doctors: d }]) => {
        setNotes(n);
        setTotal(t);
        if (d) setDoctors(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterDoctor, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.admin.notes.title}</h1>
        <p className="text-sm text-muted-foreground">{t.admin.notes.subtitle}</p>
      </div>

      <div className="flex gap-3">
        <Select value={filterDoctor || "all"} onValueChange={(v) => { setFilterDoctor(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t.admin.common.allDoctors} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.common.allDoctors}</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.notes.listTitle.replace("{count}", String(total))}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : notes.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t.admin.notes.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.medicalRecords.recordTitle}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.patient}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.doctor}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.type}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.date}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {notes.map((n) => (
                    <tr key={n.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{n.title}</td>
                      <td className="px-4 py-3 text-foreground">
                        {n.child_profiles ? `${n.child_profiles.first_name} ${n.child_profiles.last_name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">{n.doctors?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{getRecordTypeLabel(t, n.record_type)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateInTimezone(n.created_at, timezone, dateLocale)}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewNote(n)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t.admin.common.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>{t.common.previous}</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>{t.common.next}</Button>
          </div>
        </div>
      )}

      {/* Note detail dialog */}
      <Dialog open={!!viewNote} onOpenChange={() => setViewNote(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewNote?.title}</DialogTitle>
          </DialogHeader>
          {viewNote && (
            <div className="flex flex-col gap-3 text-sm">
              {viewNote.chief_complaint && <Field label={t.admin.notes.chiefComplaint} value={viewNote.chief_complaint} />}
              {viewNote.diagnosis && <Field label={t.medicalRecords.diagnosis} value={viewNote.diagnosis} />}
              {viewNote.treatment_plan && <Field label={t.admin.notes.treatmentPlan} value={viewNote.treatment_plan} />}
              {viewNote.outcome && <Field label={t.admin.notes.outcome} value={viewNote.outcome} />}
              {viewNote.follow_up_date && <Field label={t.admin.notes.followUpDate} value={viewNote.follow_up_date} />}
              {viewNote.follow_up_notes && <Field label={t.admin.notes.followUpNotes} value={viewNote.follow_up_notes} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-foreground">{value}</p>
    </div>
  );
}
