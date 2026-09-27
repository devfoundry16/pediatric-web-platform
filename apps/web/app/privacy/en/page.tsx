import type { Metadata } from "next";
import { LegalPageShell } from "@/lib/legal/legal-page-shell";
import { PrivacyPolicyEn } from "@/lib/legal/privacy-en";

/**
 * English privacy policy at a stable URL, whatever the visitor's locale.
 *
 * This is the privacy-policy URL registered with Google's OAuth consent screen
 * (Google reviews in English) and the "Read the English version" target from
 * the translated /privacy page. The header and footer still follow the
 * visitor's locale; only the policy text is forced to English/LTR.
 */
export const metadata: Metadata = {
  title: "Privacy Policy | Drsahar Pediatrics",
};

export default function PrivacyPolicyEnglishPage() {
  return (
    <LegalPageShell>
      <div dir="ltr" lang="en">
        <PrivacyPolicyEn />
      </div>
    </LegalPageShell>
  );
}
