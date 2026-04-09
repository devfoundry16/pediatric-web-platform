"use client";

import { PDFViewer } from "@react-pdf/renderer";
import {
  MedicalRecordPdfDocument,
  type MedicalRecordPdfLabels,
} from "@/components/medical-record/medical-record-pdf-document";
import type { MedicalRecord } from "@/types/medical-record";

interface MedicalRecordPdfPreviewProps {
  record: MedicalRecord;
  typeLabel: string;
  labels: MedicalRecordPdfLabels;
}

const VIEWER_HEIGHT = 520;

/**
 * Embedded PDF preview (must stay client-only; do not SSR).
 */
export function MedicalRecordPdfPreview({
  record,
  typeLabel,
  labels,
}: MedicalRecordPdfPreviewProps) {
  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-border bg-muted/30"
      style={{ height: VIEWER_HEIGHT }}
    >
      <PDFViewer width="100%" height={VIEWER_HEIGHT} showToolbar>
        <MedicalRecordPdfDocument
          record={record}
          typeLabel={typeLabel}
          labels={labels}
        />
      </PDFViewer>
    </div>
  );
}
