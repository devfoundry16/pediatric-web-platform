"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { LegalPageShell } from "@/lib/legal/legal-page-shell";
import { TermsOfServiceAr } from "@/lib/legal/terms-ar";
import { TermsOfServiceEn } from "@/lib/legal/terms-en";
import { TranslationNotice } from "@/lib/legal/translation-notice";

/**
 * Terms of service, in the visitor's language.
 *
 * Arabic visitors get the (draft) Arabic translation with a note that the
 * English text governs and a link to it. The English text also lives at the
 * stable URL /terms/en, which is the one registered with Google's OAuth
 * consent screen — Google reviews in English.
 *
 * The text itself lives in lib/legal/terms-en.tsx and terms-ar.tsx.
 */
export default function TermsOfServicePage() {
  const { locale } = useI18n();

  return (
    <LegalPageShell>
      {locale === "ar" ? (
        <TermsOfServiceAr notice={<TranslationNotice englishHref="/terms/en" />} />
      ) : (
        <TermsOfServiceEn />
      )}
    </LegalPageShell>
  );
}
