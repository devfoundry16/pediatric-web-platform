import { pdf } from "@react-pdf/renderer";
import { CourseCertificateDocument, type CertificateProps } from "@/components/courses/course-certificate-document";

export async function downloadCourseCertificate(props: CertificateProps): Promise<void> {
  const blob = await pdf(<CourseCertificateDocument {...props} />).toBlob();

  const url = URL.createObjectURL(blob);
  // Unicode-aware so Arabic titles survive (letters, digits and combining marks).
  const safeCourse = props.courseTitle
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const a = document.createElement("a");
  a.href = url;
  a.download = `certificate-${safeCourse || "course"}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
