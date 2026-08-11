"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { medicalRecordsApi, type CreateMedicalRecordPayload } from "@/lib/api/medical-records";
import { doctorApi, type DoctorPatient, type DoctorAppointment } from "@/lib/api/doctor";
import type { MedicalRecord, RecordType } from "@/types/medical-record";
import { RECORD_TYPES } from "@/types/medical-record";
import { formatDateDisplayDubai } from "@/lib/timezone";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<RecordType, string> = {
  consultation_note: "bg-blue-100 text-blue-700",
  prescription: "bg-green-100 text-green-700",
  diagnosis: "bg-purple-100 text-purple-700",
  vitals: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

// ─── Record form ──────────────────────────────────────────────────────────────

interface RecordFormState {
  childId: string;
  appointmentId: string;
  recordType: RecordType;
  title: string;
  notes: string;
  diagnosis: string;
  prescription: string;
  vitals: {
    weight_kg: string;
    height_cm: string;
    temp_c: string;
    heart_rate: string;
    oxygen_saturation: string;
  };
}

function emptyForm(): RecordFormState {
  return {
    childId: "",
    appointmentId: "",
    recordType: "consultation_note",
    title: "",
    notes: "",
    diagnosis: "",
    prescription: "",
    vitals: {
      weight_kg: "",
      height_cm: "",
      temp_c: "",
      heart_rate: "",
      oxygen_saturation: "",
    },
  };
}

function recordToForm(r: MedicalRecord): RecordFormState {
  return {
    childId: r.child_id,
    appointmentId: r.appointment_id ?? "",
    recordType: r.record_type,
    title: r.title,
    notes: r.notes ?? "",
    diagnosis: r.diagnosis ?? "",
    prescription: r.prescription ?? "",
    vitals: {
      weight_kg: r.vitals?.weight_kg != null ? String(r.vitals.weight_kg) : "",
      height_cm: r.vitals?.height_cm != null ? String(r.vitals.height_cm) : "",
      temp_c: r.vitals?.temp_c != null ? String(r.vitals.temp_c) : "",
      heart_rate: r.vitals?.heart_rate != null ? String(r.vitals.heart_rate) : "",
      oxygen_saturation:
        r.vitals?.oxygen_saturation != null ? String(r.vitals.oxygen_saturation) : "",
    },
  };
}

// ─── Child-appointment selector types ────────────────────────────────────────

interface ChildOption {
  id: string;
  name: string;
  patientGuardianName: string;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function DoctorNotesPage() {
  const { dictionary: t } = useI18n();
  const mr = t.medicalRecords;

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Patients (for child selection in form)
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  // Appointments for selected child (for optional link)
  const [childAppointments, setChildAppointments] = useState<DoctorAppointment[]>([]);

  // Form dialog
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [form, setForm] = useState<RecordFormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadRecords = useCallback(() => {
    setIsLoading(true);
    medicalRecordsApi
      .list()
      .then(setRecords)
      .catch(() => toast.error(mr.loadError))
      .finally(() => setIsLoading(false));
  }, [mr.loadError]);

  useEffect(() => {
    loadRecords();
    doctorApi.getPatients().then(setPatients).catch(() => {});
  }, [loadRecords]);

  // Build child options from patients list
  const childOptions: ChildOption[] = patients.map((p) => ({
    id: p.child_id,
    name: p.child
      ? `${p.child.first_name} ${p.child.last_name}`
      : p.child_id,
    patientGuardianName: p.guardian_name,
  }));

  // When child changes in the form, load their appointments
  useEffect(() => {
    if (!form.childId) {
      setChildAppointments([]);
      return;
    }
    doctorApi
      .getAppointments()
      .then(({ appointments: appts }) =>
        setChildAppointments(
          appts.filter(
            (a) =>
              (a as DoctorAppointment & { child_id?: string }).child_id === form.childId ||
              (a.child_profiles?.id === form.childId)
          )
        )
      )
      .catch(() => {});
  }, [form.childId]);

  // ─── Form helpers ──────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingRecord(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  }

  function openEditForm(record: MedicalRecord) {
    setEditingRecord(record);
    setForm(recordToForm(record));
    setIsFormOpen(true);
  }

  function setField<K extends keyof RecordFormState>(key: K, value: RecordFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setVital(key: keyof RecordFormState["vitals"], value: string) {
    setForm((prev) => ({ ...prev, vitals: { ...prev.vitals, [key]: value } }));
  }

  function buildPayload(): CreateMedicalRecordPayload {
    const vitalsHasData = Object.values(form.vitals).some((v) => v !== "");
    const vitals = vitalsHasData
      ? {
          weight_kg: form.vitals.weight_kg ? Number(form.vitals.weight_kg) : undefined,
          height_cm: form.vitals.height_cm ? Number(form.vitals.height_cm) : undefined,
          temp_c: form.vitals.temp_c ? Number(form.vitals.temp_c) : undefined,
          heart_rate: form.vitals.heart_rate ? Number(form.vitals.heart_rate) : undefined,
          oxygen_saturation: form.vitals.oxygen_saturation
            ? Number(form.vitals.oxygen_saturation)
            : undefined,
        }
      : undefined;

    return {
      childId: form.childId,
      appointmentId: form.appointmentId || undefined,
      recordType: form.recordType,
      title: form.title,
      notes: form.notes || undefined,
      diagnosis: form.diagnosis || undefined,
      prescription: form.prescription || undefined,
      vitals,
    };
  }

  async function handleSave() {
    if (!form.childId || !form.title.trim()) return;
    setIsSaving(true);
    try {
      if (editingRecord) {
        const payload = buildPayload();
        await medicalRecordsApi.update(editingRecord.id, {
          recordType: payload.recordType,
          title: payload.title,
          notes: payload.notes,
          diagnosis: payload.diagnosis,
          prescription: payload.prescription,
          vitals: payload.vitals,
        });
      } else {
        await medicalRecordsApi.create(buildPayload());
      }
      toast.success(mr.saveSuccess);
      setIsFormOpen(false);
      loadRecords();
    } catch {
      toast.error(mr.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await medicalRecordsApi.delete(deleteId);
      toast.success(mr.deleteSuccess);
      setDeleteId(null);
      loadRecords();
    } catch {
      toast.error(mr.deleteError);
    } finally {
      setIsDeleting(false);
    }
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  function getTypeLabelKey(type: RecordType) {
    return mr[`type_${type}` as keyof typeof mr] as string;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{mr.doctorTitle}</h1>
            <p className="text-muted-foreground">{mr.doctorSubtitle}</p>
          </div>
          <Button onClick={openAddForm} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            {mr.addRecord}
          </Button>
        </div>

        {/* Records list */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">{mr.noRecords}</p>
                <Button variant="outline" onClick={openAddForm} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {mr.addRecord}
                </Button>
              </CardContent>
            </Card>
          ) : (
            records.map((record) => {
              const childName = record.child_profiles
                ? `${record.child_profiles.first_name} ${record.child_profiles.last_name}`
                : "—";

              return (
                <Card key={record.id} className="transition-shadow hover:shadow-sm">
                  <CardContent className="flex items-start justify-between gap-4 p-5">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[record.record_type]}`}
                        >
                          {getTypeLabelKey(record.record_type)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateDisplayDubai(record.created_at)}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground truncate">{record.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {mr.patient}: <span className="text-foreground">{childName}</span>
                      </p>
                      {record.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{record.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditForm(record)}
                        title={mr.editRecord}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(record.id)}
                        title={mr.deleteRecord}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? mr.editRecord : mr.addRecord}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Child selector (only when creating) */}
            {!editingRecord && (
              <div className="flex flex-col gap-1.5">
                <Label>{mr.selectChild}</Label>
                <Select value={form.childId} onValueChange={(v) => setField("childId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={mr.selectChild} />
                  </SelectTrigger>
                  <SelectContent>
                    {childOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{" "}
                        <span className="text-muted-foreground text-xs">
                          ({c.patientGuardianName})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Appointment link */}
            {!editingRecord && form.childId && (
              <div className="flex flex-col gap-1.5">
                <Label>{mr.selectAppointment}</Label>
                <Select
                  value={form.appointmentId || "__none__"}
                  onValueChange={(v) => setField("appointmentId", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={mr.noAppointment} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{mr.noAppointment}</SelectItem>
                    {childAppointments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.scheduled_date} · {a.consultation_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Record type */}
            <div className="flex flex-col gap-1.5">
              <Label>{mr.recordType}</Label>
              <Select
                value={form.recordType}
                onValueChange={(v) => setField("recordType", v as RecordType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getTypeLabelKey(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label>{mr.recordTitle}</Label>
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder={mr.recordTitle}
              />
            </div>

            {/* Notes — always */}
            <div className="flex flex-col gap-1.5">
              <Label>{mr.notes}</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder={mr.notes}
              />
            </div>

            {/* Diagnosis */}
            {(form.recordType === "diagnosis" || form.recordType === "consultation_note") && (
              <div className="flex flex-col gap-1.5">
                <Label>{mr.diagnosis}</Label>
                <Textarea
                  rows={2}
                  value={form.diagnosis}
                  onChange={(e) => setField("diagnosis", e.target.value)}
                  placeholder={mr.diagnosis}
                />
              </div>
            )}

            {/* Prescription */}
            {(form.recordType === "prescription" || form.recordType === "consultation_note") && (
              <div className="flex flex-col gap-1.5">
                <Label>{mr.prescription}</Label>
                <Textarea
                  rows={2}
                  value={form.prescription}
                  onChange={(e) => setField("prescription", e.target.value)}
                  placeholder={mr.prescription}
                />
              </div>
            )}

            {/* Vitals */}
            {(form.recordType === "vitals" || form.recordType === "consultation_note") && (
              <Card className="border border-border/60">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-medium">{mr.vitals}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["weight_kg", mr.weight],
                        ["height_cm", mr.height],
                        ["temp_c", mr.temperature],
                        ["heart_rate", mr.heartRate],
                        ["oxygen_saturation", mr.oxygenSaturation],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form.vitals[key]}
                          onChange={(e) => setVital(key, e.target.value)}
                          placeholder="—"
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.childId || !form.title.trim()}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mr.deleteRecord}</AlertDialogTitle>
            <AlertDialogDescription>{mr.deleteRecordConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mr.deleteRecord}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
