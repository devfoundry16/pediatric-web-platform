"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { medicalRecordsApi } from "@/lib/api/medical-records";
import { childrenApi } from "@/lib/api/children";
import type { MedicalRecord, RecordType } from "@/types/medical-record";
import type { ChildProfile } from "@/types/child";
import { formatDateDisplayDubai } from "@/lib/timezone";
import type { MedicalRecordPdfLabels } from "@/components/medical-record/medical-record-pdf-document";
import { downloadMedicalRecordPdf } from "@/lib/medical-record-pdf-download";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const MedicalRecordPdfPreview = dynamic(
  () =>
    import("@/components/medical-record/medical-record-pdf-preview").then(
      (m) => m.MedicalRecordPdfPreview
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[520px] w-full rounded-lg" />,
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<RecordType, string> = {
  consultation_note: "bg-blue-100 text-blue-700",
  prescription: "bg-green-100 text-green-700",
  diagnosis: "bg-purple-100 text-purple-700",
  vitals: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

function toPdfLabels(mr: Dictionary["medicalRecords"]): MedicalRecordPdfLabels {
  return {
    documentHeader: mr.printTitle,
    patient: mr.patient,
    doctor: mr.doctor,
    date: mr.date,
    recordType: mr.recordType,
    recordTitle: mr.recordTitle,
    notes: mr.notes,
    diagnosis: mr.diagnosis,
    prescription: mr.prescription,
    vitals: mr.vitals,
    weight: mr.weight,
    height: mr.height,
    temperature: mr.temperature,
    heartRate: mr.heartRate,
    oxygenSaturation: mr.oxygenSaturation,
  };
}

const ALL_TAB = "__all__";

export default function ParentRecordsPage() {
  const { dictionary: t } = useI18n();
  const mr = t.medicalRecords;

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChild, setActiveChild] = useState<string>(ALL_TAB);

  const [pdfRecord, setPdfRecord] = useState<MedicalRecord | null>(null);
  const [downloadingRecordId, setDownloadingRecordId] = useState<string | null>(null);

  const pdfLabels = useMemo(() => toPdfLabels(mr), [mr]);

  const loadData = useCallback(() => {
    setIsLoading(true);
    Promise.all([childrenApi.list(), medicalRecordsApi.list()])
      .then(([kids, recs]) => {
        setChildren(kids);
        setRecords(recs);
      })
      .catch(() => toast.error(mr.loadError))
      .finally(() => setIsLoading(false));
  }, [mr.loadError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRecords =
    activeChild === ALL_TAB
      ? records
      : records.filter((r) => r.child_id === activeChild);

  function getTypeLabelKey(type: RecordType): string {
    return mr[`type_${type}` as keyof typeof mr] as string;
  }

  async function handleDownloadPdf(record: MedicalRecord) {
    setDownloadingRecordId(record.id);
    try {
      await downloadMedicalRecordPdf(
        record,
        getTypeLabelKey(record.record_type),
        pdfLabels
      );
      toast.success(mr.pdfDownloadSuccess);
    } catch {
      toast.error(mr.pdfDownloadError);
    } finally {
      setDownloadingRecordId(null);
    }
  }

  return (
    <DashboardLayout role="parent">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{mr.title}</h1>
          <p className="text-muted-foreground">{mr.subtitle}</p>
        </div>

        {!isLoading && children.length > 1 && (
          <Tabs value={activeChild} onValueChange={setActiveChild}>
            <TabsList>
              <TabsTrigger value={ALL_TAB}>{mr.allChildren}</TabsTrigger>
              {children.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.personalInfo.firstName} {c.personalInfo.lastName}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))
          ) : filteredRecords.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">{mr.noRecords}</p>
                <p className="text-sm text-muted-foreground/70">{mr.noRecordsHint}</p>
              </CardContent>
            </Card>
          ) : (
            filteredRecords.map((record) => {
              const childName = record.child_profiles
                ? `${record.child_profiles.first_name} ${record.child_profiles.last_name}`
                : "—";
              const doctorName = record.doctors?.full_name ?? "—";

              return (
                <Card key={record.id} className="transition-shadow hover:shadow-sm">
                  <CardContent className="flex items-start justify-between gap-4 p-5">
                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
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
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                        {children.length > 1 && (
                          <span>
                            {mr.patient}:{" "}
                            <span className="text-foreground">{childName}</span>
                          </span>
                        )}
                        <span>
                          {mr.doctor}:{" "}
                          <span className="text-foreground">{doctorName}</span>
                        </span>
                      </div>
                      {record.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{record.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 items-end sm:flex-row sm:items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setPdfRecord(record)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {mr.previewPdf}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        disabled={downloadingRecordId !== null}
                        onClick={() => void handleDownloadPdf(record)}
                      >
                        {downloadingRecordId === record.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {mr.downloadPdf}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog
        open={!!pdfRecord}
        onOpenChange={(open) => {
          if (!open) setPdfRecord(null);
        }}
      >
        <DialogContent className="flex max-h-[95vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{mr.pdfDialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {pdfRecord && (
              <MedicalRecordPdfPreview
                record={pdfRecord}
                typeLabel={getTypeLabelKey(pdfRecord.record_type)}
                labels={pdfLabels}
              />
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => setPdfRecord(null)}>
              {t.common.cancel}
            </Button>
            <Button
              className="gap-1.5"
              disabled={!pdfRecord || downloadingRecordId !== null}
              onClick={() => pdfRecord && void handleDownloadPdf(pdfRecord)}
            >
              {pdfRecord && downloadingRecordId === pdfRecord.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {mr.downloadPdf}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
