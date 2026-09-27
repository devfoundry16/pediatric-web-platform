import { pdf } from "@react-pdf/renderer";
import {
  MedicalRecordPdfDocument,
  type MedicalRecordPdfDocumentProps,
  type MedicalRecordPdfLabels,
} from "@/components/medical-record/medical-record-pdf-document";
import type { MedicalRecord } from "@/types/medical-record";

export async function downloadMedicalRecordPdf(
  record: MedicalRecord,
  typeLabel: string,
  labels: MedicalRecordPdfLabels,
  { dateLocale, dir }: Pick<MedicalRecordPdfDocumentProps, "dateLocale" | "dir">
): Promise<void> {
  const blob = await pdf(
    <MedicalRecordPdfDocument
      record={record}
      typeLabel={typeLabel}
      labels={labels}
      dateLocale={dateLocale}
      dir={dir}
    />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  // Unicode-aware so Arabic titles survive (letters, digits and combining marks).
  const safe =
    record.title
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "record";
  const a = document.createElement("a");
  a.href = url;
  a.download = `medical-record-${safe}-${record.id.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
