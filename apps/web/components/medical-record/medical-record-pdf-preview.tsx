"use client";

import { PDFViewer } from "@react-pdf/renderer";
import {
  MedicalRecordPdfDocument,
  type MedicalRecordPdfDocumentProps,
} from "@/components/medical-record/medical-record-pdf-document";

type MedicalRecordPdfPreviewProps = MedicalRecordPdfDocumentProps;

const VIEWER_HEIGHT = 520;

/**
 * Embedded PDF preview (must stay client-only; do not SSR).
 */
export function MedicalRecordPdfPreview({
  record,
  typeLabel,
  labels,
  dateLocale,
  dir,
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
          dateLocale={dateLocale}
          dir={dir}
        />
      </PDFViewer>
    </div>
  );
}
