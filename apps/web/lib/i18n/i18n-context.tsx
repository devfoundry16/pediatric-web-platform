"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Locale } from "./config";
import { defaultLocale, localeDirections, locales } from "./config";
import type { Dictionary } from "./get-dictionary";

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
          // A failed dictionary chunk load falls back to English; leave a
          // trace so "the site ignores my language" reports are debuggable.
          console.warn("Failed to restore saved locale", err);
        });
      }
    } catch {
      // ignore (e.g. private browsing)
    }
  }, [locale, setLocale]);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("lang", locale);
    html.setAttribute("dir", localeDirections[locale]);

    // Swap font class on body for Arabic (Cairo) vs English (Inter)
    const body = document.body;
    if (localeDirections[locale] === "rtl") {
      body.classList.add("font-cairo");
      body.classList.remove("font-sans");
    } else {
      body.classList.add("font-sans");
      body.classList.remove("font-cairo");
    }
  }, [locale]);

  const dir = localeDirections[locale];
  const isRtl = dir === "rtl";
  const dateLocale = locale === "ar" ? "ar-AE" : "en-AE";

  return (
    <I18nContext.Provider
      value={{ locale, dictionary, setLocale, dir, isRtl, dateLocale }}
    >
      {children}
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
