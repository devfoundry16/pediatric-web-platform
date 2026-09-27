"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LegalPageShell } from "@/lib/legal/legal-page-shell";
import { PrivacyPolicyAr } from "@/lib/legal/privacy-ar";
import { PrivacyPolicyEn } from "@/lib/legal/privacy-en";
import { TranslationNotice } from "@/lib/legal/translation-notice";

/**
 * Privacy policy, in the visitor's language.
 *
 * Arabic visitors get the (draft) Arabic translation with a note that the
 * English text governs and a link to it. The English text also lives at the
 * stable URL /privacy/en, which is the one registered with Google's OAuth
 * consent screen — Google reviews in English.
 *
 * The text itself lives in lib/legal/privacy-en.tsx and privacy-ar.tsx.
 */
export default function PrivacyPolicyPage() {
  const { locale } = useI18n();

  return (
    <LegalPageShell>
      {locale === "ar" ? (
        <PrivacyPolicyAr notice={<TranslationNotice englishHref="/privacy/en" />} />
      ) : (
        <PrivacyPolicyEn />
      )}
    </LegalPageShell>
  );
}
