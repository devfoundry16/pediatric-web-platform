import { pdf } from "@react-pdf/renderer";
import {
  MedicalRecordPdfDocument,
  type MedicalRecordPdfLabels,
} from "@/components/medical-record/medical-record-pdf-document";
import type { MedicalRecord } from "@/types/medical-record";

export async function downloadMedicalRecordPdf(
  record: MedicalRecord,
  typeLabel: string,
  labels: MedicalRecordPdfLabels
): Promise<void> {
  const blob = await pdf(
    <MedicalRecordPdfDocument
      record={record}
      typeLabel={typeLabel}
      labels={labels}
    />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const safe = record.title.replace(/[^\w\s-]/g, "").slice(0, 40) || "record";
  const a = document.createElement("a");
  a.href = url;
  a.download = `medical-record-${safe}-${record.id.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
