import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  border: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 3,
    borderColor: "#0d9488",
    borderRadius: 4,
  },
  innerBorder: {
    position: "absolute",
    top: 28,
    left: 28,
    right: 28,
    bottom: 28,
    borderWidth: 1,
    borderColor: "#ccfbf1",
    borderRadius: 2,
  },
  content: {
    alignItems: "center",
    textAlign: "center",
    paddingTop: 60,
  },
  appName: {
    fontSize: 11,
    color: "#0d9488",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 32,
  },
  recipientLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#0d9488",
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    minWidth: 200,
    textAlign: "center",
  },
  completionText: {
    fontSize: 11,
    color: "#374151",
    marginBottom: 8,
    lineHeight: 1.6,
  },
  courseTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginBottom: 4,
    textAlign: "center",
  },
  instructorText: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 32,
  },
  dateRow: {
    flexDirection: "row",
    gap: 48,
    marginTop: 24,
  },
  dateBox: {
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 8,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },
  dateValue: {
    fontSize: 10,
    color: "#374151",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 4,
    minWidth: 120,
    textAlign: "center",
  },
});

export interface CertificateProps {
  recipientName: string;
  courseTitle: string;
  instructorName: string | null;
  completedAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CourseCertificateDocument({
  recipientName,
  courseTitle,
  instructorName,
  completedAt,
}: CertificateProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border} />
        <View style={styles.innerBorder} />

        <View style={styles.content}>
          <Text style={styles.appName}>Drsahar Pediatrics</Text>
          <Text style={styles.heading}>Certificate of Completion</Text>
          <Text style={styles.subheading}>
            This is to certify that
          </Text>

          <Text style={styles.recipientLabel}>presented to</Text>
          <Text style={styles.recipientName}>{recipientName}</Text>

          <Text style={styles.completionText}>has successfully completed the course</Text>
          <Text style={styles.courseTitle}>{courseTitle}</Text>

          {instructorName && (
            <Text style={styles.instructorText}>Instructed by {instructorName}</Text>
          )}

          <View style={styles.dateRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateValue}>{formatDate(completedAt)}</Text>
              <Text style={styles.dateLabel}>Date of Completion</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
