"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { z } from "zod";
import zodAr from "zod/v4/locales/ar.js";
import zodEn from "zod/v4/locales/en.js";
import { DirectionProvider } from "@/components/ui/direction";
import type { Locale } from "./config";
import { localeDirections, locales } from "./config";
import type { Dictionary } from "./get-dictionary";

// Zod's built-in messages cover checks that have no custom message (vitals
// ranges, max lengths, enums). Configured globally because schemas are built
// once at module scope.
const zodLocales: Record<Locale, () => Parameters<typeof z.config>[0]> = {
  en: zodEn,
  ar: zodAr,
};

interface I18nContextType {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
  dir: "ltr" | "rtl";
  isRtl: boolean;
  dateLocale: string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({
  children,
  initialLocale,
  initialDictionary,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialDictionary: Dictionary;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [dictionary, setDictionary] = useState<Dictionary>(initialDictionary);

  const setLocale = useCallback(async (newLocale: Locale) => {
    const dict = await import(`./dictionaries/${newLocale}.json`);
    setDictionary(dict.default);
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", newLocale);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("locale");
      if (stored && locales.includes(stored as Locale) && stored !== locale) {
        void setLocale(stored as Locale).catch((err) => {
          // A failed dictionary chunk load keeps the default locale; leave a
          // trace so "the site ignores my language" reports are debuggable.
          console.warn("Failed to restore saved locale", err);
        });
      }
    } catch {
      // ignore (e.g. private browsing)
    }
  }, [locale, setLocale]);

  useEffect(() => {
    // The font follows `dir` through the [dir] rules in globals.css.
    const html = document.documentElement;
    html.setAttribute("lang", locale);
    html.setAttribute("dir", localeDirections[locale]);
  }, [locale]);

  // Set during render, not in an effect, so a form validated in the same
  // render as a language switch already gets the new language.
  z.config(zodLocales[locale]());

  const dir = localeDirections[locale];
  const isRtl = dir === "rtl";
  const dateLocale = locale === "ar" ? "ar-AE" : "en-AE";

  return (
    <I18nContext.Provider
      value={{ locale, dictionary, setLocale, dir, isRtl, dateLocale }}
    >
      {/* Radix primitives (Tabs, Select, DropdownMenu, RadioGroup) read their
          direction from this, not from <html dir>. */}
      <DirectionProvider dir={dir}>{children}</DirectionProvider>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
