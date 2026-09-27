import type { Metadata } from "next";
import { LegalPageShell } from "@/lib/legal/legal-page-shell";
import { TermsOfServiceEn } from "@/lib/legal/terms-en";

/**
 * English terms of service at a stable URL, whatever the visitor's locale.
 *
 * This is the terms URL registered with Google's OAuth consent screen (Google
 * reviews in English) and the "Read the English version" target from the
 * translated /terms page. The header and footer still follow the visitor's
 * locale; only the terms text is forced to English/LTR.
 */
export const metadata: Metadata = {
  title: "Terms of Service | Drsahar Pediatrics",
};

export default function TermsOfServiceEnglishPage() {
  return (
    <LegalPageShell>
      <div dir="ltr" lang="en">
        <TermsOfServiceEn />
      </div>
    </LegalPageShell>
  );
}
