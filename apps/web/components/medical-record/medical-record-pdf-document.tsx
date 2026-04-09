import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { MedicalRecord, Vitals } from "@/types/medical-record";
import { formatDateDisplayDubai } from "@/lib/timezone";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
  },
  docTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#0f766e",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerCol: { maxWidth: "48%" },
  label: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  value: { fontSize: 10, marginBottom: 4 },
  metaRow: { flexDirection: "row", gap: 16, marginBottom: 12, flexWrap: "wrap" },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#6b7280",
    marginTop: 10,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  body: { fontSize: 10, lineHeight: 1.45 },
  vitalRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  vitalBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    width: "30%",
    minWidth: 120,
  },
  vitalLabel: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  vitalValue: { fontSize: 10, fontWeight: "bold" },
});

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

export function MedicalRecordPdfDocument({
  record,
  typeLabel,
  labels,
}: {
  record: MedicalRecord;
  typeLabel: string;
  labels: MedicalRecordPdfLabels;
}) {
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
            <Text style={[styles.label, { textAlign: "right" }]}>{labels.doctor}</Text>
            <Text style={[styles.value, { textAlign: "right" }]}>{doctorName}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.label}>{labels.recordType}</Text>
            <Text style={styles.value}>{typeLabel}</Text>
          </View>
          <View>
            <Text style={styles.label}>{labels.date}</Text>
            <Text style={styles.value}>{formatDateDisplayDubai(record.created_at)}</Text>
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
