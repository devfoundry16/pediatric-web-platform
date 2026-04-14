import { pdf } from "@react-pdf/renderer";
import { CourseCertificateDocument, type CertificateProps } from "@/components/courses/course-certificate-document";

export async function downloadCourseCertificate(props: CertificateProps): Promise<void> {
  const blob = await pdf(<CourseCertificateDocument {...props} />).toBlob();

  const url = URL.createObjectURL(blob);
  const safeCourse = props.courseTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  const a = document.createElement("a");
  a.href = url;
  a.download = `certificate-${safeCourse}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
