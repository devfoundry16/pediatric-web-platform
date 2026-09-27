import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY, registerPdfFonts } from "@/lib/pdf-fonts";

registerPdfFonts();

type PdfDir = "ltr" | "rtl";

// `direction` is not inherited in react-pdf, so every Text carries it (it sets
// the bidi base level for mixed Arabic/Latin lines).
function createStyles(dir: PdfDir) {
  const rtl = dir === "rtl";
  const text = { direction: dir };

  return StyleSheet.create({
    page: {
      padding: 60,
      fontFamily: PDF_FONT_FAMILY,
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
    // Vertical centering comes from the page's justifyContent; Cairo's line
    // box is taller than Helvetica's, so no extra top padding (keeps one page).
    content: {
      alignItems: "center",
      textAlign: "center",
    },
    // The brand name is always Latin, so its tracking/uppercase stay as-is.
    appName: {
      fontSize: 11,
      color: "#0d9488",
      letterSpacing: 3,
      textTransform: "uppercase",
      marginBottom: 24,
    },
    heading: {
      ...text,
      fontSize: 28,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 8,
    },
    subheading: {
      ...text,
      fontSize: 13,
      color: "#6b7280",
      marginBottom: 32,
    },
    recipientLabel: {
      ...text,
      fontSize: 11,
      color: "#6b7280",
      marginBottom: 8,
    },
    // The underline lives on a wrapping View: react-pdf does not centre text
    // inside a Text box widened by minWidth.
    recipientBox: {
      alignItems: "center",
      marginBottom: 24,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
      minWidth: 200,
    },
    recipientName: {
      ...text,
      fontSize: 20,
      fontWeight: "bold",
      color: "#0d9488",
      textAlign: "center",
    },
    completionText: {
      ...text,
      fontSize: 11,
      color: "#374151",
      marginBottom: 8,
      lineHeight: 1.6,
    },
    courseTitle: {
      ...text,
      fontSize: 16,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 4,
      textAlign: "center",
    },
    instructorText: {
      ...text,
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
    // letterSpacing breaks Arabic cursive joining; uppercase is Latin-only.
    dateLabel: {
      ...text,
      fontSize: 8,
      color: "#9ca3af",
      marginTop: 4,
      ...(rtl ? {} : { textTransform: "uppercase" as const, letterSpacing: 1 }),
    },
    dateValueBox: {
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: "#d1d5db",
      paddingBottom: 4,
      minWidth: 120,
    },
    dateValue: {
      ...text,
      fontSize: 10,
      color: "#374151",
      textAlign: "center",
    },
  });
}

const stylesByDir: Record<PdfDir, ReturnType<typeof createStyles>> = {
  ltr: createStyles("ltr"),
  rtl: createStyles("rtl"),
};

export interface CertificateLabels {
  /** t.courses.certificateHeading */
  heading: string;
  /** t.courses.certificateCertify */
  certify: string;
  /** t.courses.certificatePresentedTo */
  presentedTo: string;
  /** t.courses.certificateCompleted */
  completed: string;
  /** t.courses.certificateInstructedBy, contains a `{name}` placeholder */
  instructedBy: string;
  /** t.courses.certificateDateLabel */
  dateLabel: string;
}

export interface CertificateProps {
  recipientName: string;
  courseTitle: string;
  instructorName: string | null;
  completedAt: string;
  labels: CertificateLabels;
  /** Locale for the date: `dateLocale` from useI18n() ("ar-AE" / "en-AE"). */
  dateLocale: string;
  /** Text direction: `dir` from useI18n(). */
  dir: PdfDir;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
}

export function CourseCertificateDocument({
  recipientName,
  courseTitle,
  instructorName,
  completedAt,
  labels,
  dateLocale,
  dir,
}: CertificateProps) {
  const styles = stylesByDir[dir];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
        <View style={styles.border} />
        <View style={styles.innerBorder} />

        <View style={styles.content}>
          <Text style={styles.appName}>Drsahar Pediatrics</Text>
          <Text style={styles.heading}>{labels.heading}</Text>
          <Text style={styles.subheading}>{labels.certify}</Text>

          <Text style={styles.recipientLabel}>{labels.presentedTo}</Text>
          <View style={styles.recipientBox}>
            <Text style={styles.recipientName}>{recipientName}</Text>
          </View>

          <Text style={styles.completionText}>{labels.completed}</Text>
          <Text style={styles.courseTitle}>{courseTitle}</Text>

          {instructorName && (
            <Text style={styles.instructorText}>
              {labels.instructedBy.replace("{name}", instructorName)}
            </Text>
          )}

          <View style={styles.dateRow}>
            <View style={styles.dateBox}>
              <View style={styles.dateValueBox}>
                <Text style={styles.dateValue}>{formatDate(completedAt, dateLocale)}</Text>
              </View>
              <Text style={styles.dateLabel}>{labels.dateLabel}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
