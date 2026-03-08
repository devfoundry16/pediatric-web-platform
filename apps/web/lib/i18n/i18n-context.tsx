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
import { defaultLocale, localeDirections } from "./config";
import type { Dictionary } from "./get-dictionary";

interface I18nContextType {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
  dir: "ltr" | "rtl";
  isRtl: boolean;
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

  return (
    <I18nContext.Provider value={{ locale, dictionary, setLocale, dir, isRtl }}>
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
