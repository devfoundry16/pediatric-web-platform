"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";

/**
 * Shown under the title of a translated legal page: says the English text
 * governs and links to it.
 */
export function TranslationNotice({ englishHref }: { englishHref: string }) {
  const { dictionary: t } = useI18n();

  return (
    <p className="mt-4 text-sm text-muted-foreground">
      {t.common.legalTranslationNote}{" "}
      <Link href={englishHref} hrefLang="en" className="text-primary underline">
        {t.common.readInEnglish}
      </Link>
    </p>
  );
}
