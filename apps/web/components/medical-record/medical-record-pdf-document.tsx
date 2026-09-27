import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { MedicalRecord, Vitals } from "@/types/medical-record";
import { formatDateDisplayDubai } from "@/lib/timezone";
import { PDF_FONT_FAMILY, registerPdfFonts } from "@/lib/pdf-fonts";

registerPdfFonts();

type PdfDir = "ltr" | "rtl";

// react-pdf has no document-level direction: `direction` is not inherited, so
// every Text carries it (it sets the bidi base level), and rows are mirrored by
// hand with row-reverse. textAlign must be explicit: react-pdf only compensates
// alignment in shrink-to-fit boxes for an explicit textAlign, so the implicit
// right alignment of RTL text would be drawn outside its box.
function createStyles(dir: PdfDir) {
  const rtl = dir === "rtl";
  const text = { direction: dir, textAlign: rtl ? "right" : "left" } as const;
  // Uppercase is Latin-only styling; skip it for Arabic.
  const caps = rtl ? {} : { textTransform: "uppercase" as const };
  const row = rtl ? ("row-reverse" as const) : ("row" as const);

  return StyleSheet.create({
    page: {
      padding: 40,
      fontFamily: PDF_FONT_FAMILY,
      fontSize: 10,
      color: "#111827",
    },
    docTitle: {
      ...text,
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 16,
      color: "#0f766e",
    },
    headerRow: {
      flexDirection: row,
      justifyContent: "space-between",
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
    },
    headerCol: { maxWidth: "48%" },
    // The trailing header column is aligned to the page's far edge.
    endAligned: { textAlign: rtl ? "left" : "right" },
    label: {
      ...text,
      ...caps,
      fontSize: 8,
      color: "#6b7280",
      marginBottom: 3,
    },
    value: { ...text, fontSize: 10, marginBottom: 4 },
    metaRow: { flexDirection: row, gap: 16, marginBottom: 12, flexWrap: "wrap" },
    sectionTitle: {
      ...text,
      ...caps,
      fontSize: 9,
      fontWeight: "bold",
      color: "#6b7280",
      marginTop: 10,
      marginBottom: 4,
    },
    body: { ...text, fontSize: 10, lineHeight: 1.45 },
    vitalRow: { flexDirection: row, flexWrap: "wrap", gap: 8, marginTop: 6 },
    vitalBox: {
      borderWidth: 1,
      borderColor: "#e5e7eb",
      borderRadius: 4,
      padding: 8,
      width: "30%",
      minWidth: 120,
    },
    vitalLabel: { ...text, fontSize: 8, color: "#6b7280", marginBottom: 2 },
    vitalValue: { ...text, fontSize: 10, fontWeight: "bold" },
  });
}

const stylesByDir: Record<PdfDir, ReturnType<typeof createStyles>> = {
  ltr: createStyles("ltr"),
  rtl: createStyles("rtl"),
};

export interface MedicalRecordPdfLabels {
  documentHeader: string;
  patient: string;
  doctor: string;
  date: string;
  recordType: string;
  recordTitle: string;
  notes: string;
  diagnosis: string;
  prescription: string;
  vitals: string;
  weight: string;
  height: string;
  temperature: string;
  heartRate: string;
  oxygenSaturation: string;
}

export interface MedicalRecordPdfDocumentProps {
  record: MedicalRecord;
  typeLabel: string;
  labels: MedicalRecordPdfLabels;
  /** Locale for dates: `dateLocale` from useI18n() ("ar-AE" / "en-AE"). */
  dateLocale: string;
  /** Text direction: `dir` from useI18n(). */
  dir: PdfDir;
}

export function MedicalRecordPdfDocument({
  record,
  typeLabel,
  labels,
  dateLocale,
  dir,
}: MedicalRecordPdfDocumentProps) {
  const styles = stylesByDir[dir];
  const childName = record.child_profiles
    ? `${record.child_profiles.first_name} ${record.child_profiles.last_name}`
    : "—";
  const doctorName = record.doctors?.full_name ?? "—";

  const vitals = record.vitals;
  const vitalDefs: [keyof Vitals, string][] = [
    ["weight_kg", labels.weight],
    ["height_cm", labels.height],
    ["temp_c", labels.temperature],
    ["heart_rate", labels.heartRate],
    ["oxygen_saturation", labels.oxygenSaturation],
  ];
  const vitalEntries = vitals
    ? vitalDefs.filter(([k]) => vitals[k] != null)
    : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.docTitle}>{labels.documentHeader}</Text>

        <View style={styles.headerRow}>
          <View style={styles.headerCol}>
            <Text style={styles.label}>{labels.patient}</Text>
            <Text style={styles.value}>{childName}</Text>
          </View>
          <View style={styles.headerCol}>
            <Text style={[styles.label, styles.endAligned]}>{labels.doctor}</Text>
            <Text style={[styles.value, styles.endAligned]}>{doctorName}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.label}>{labels.recordType}</Text>
            <Text style={styles.value}>{typeLabel}</Text>
          </View>
          <View>
            <Text style={styles.label}>{labels.date}</Text>
            <Text style={styles.value}>
              {formatDateDisplayDubai(record.created_at, dateLocale)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{labels.recordTitle}</Text>
        <Text style={styles.body}>{record.title}</Text>

        {record.notes ? (
          <>
            <Text style={styles.sectionTitle}>{labels.notes}</Text>
            <Text style={styles.body}>{record.notes}</Text>
          </>
        ) : null}

        {record.diagnosis ? (
          <>
            <Text style={styles.sectionTitle}>{labels.diagnosis}</Text>
            <Text style={styles.body}>{record.diagnosis}</Text>
          </>
        ) : null}

        {record.prescription ? (
          <>
            <Text style={styles.sectionTitle}>{labels.prescription}</Text>
            <Text style={styles.body}>{record.prescription}</Text>
          </>
        ) : null}

        {vitalEntries.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{labels.vitals}</Text>
            <View style={styles.vitalRow}>
              {vitalEntries.map(([key, label]) => (
                <View key={key} style={styles.vitalBox}>
                  <Text style={styles.vitalLabel}>{label}</Text>
                  <Text style={styles.vitalValue}>{String(vitals![key])}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </Page>
    </Document>
  );
}
