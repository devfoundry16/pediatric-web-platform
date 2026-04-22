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

export default function AdminNotesPage() {
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
        <h1 className="text-2xl font-bold text-foreground">Medical Notes</h1>
        <p className="text-sm text-muted-foreground">View appointment notes and consultation outcomes</p>
      </div>

      <div className="flex gap-3">
        <Select value={filterDoctor || "all"} onValueChange={(v) => { setFilterDoctor(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All doctors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notes ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : notes.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No notes found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
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
                      <td className="px-4 py-3 capitalize text-muted-foreground">{n.record_type}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</td>
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
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
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
              {viewNote.chief_complaint && <Field label="Chief complaint" value={viewNote.chief_complaint} />}
              {viewNote.diagnosis && <Field label="Diagnosis" value={viewNote.diagnosis} />}
              {viewNote.treatment_plan && <Field label="Treatment plan" value={viewNote.treatment_plan} />}
              {viewNote.outcome && <Field label="Outcome" value={viewNote.outcome} />}
              {viewNote.follow_up_date && <Field label="Follow-up date" value={viewNote.follow_up_date} />}
              {viewNote.follow_up_notes && <Field label="Follow-up notes" value={viewNote.follow_up_notes} />}
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
