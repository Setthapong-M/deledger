"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { localeCookie, type Locale } from "./locale";
import { localizedError } from "./localized-error";

export type { Locale } from "./locale";
export type Messages = Record<string, { th: string; en: string }>;

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({
  locale: "th",
  setLocale: () => {},
});

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
    updateLocale(next);
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useCopy<T extends Messages>(messages: T) {
  const { locale } = useLocale();
  const t = useCallback((key: keyof T, values?: Record<string, string | number>): string => {
    const text = messages[key][locale];
    return values ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match)) : text;
  }, [locale, messages]);
  const errorMessage = useCallback((reason: unknown) => localizedError(reason, locale), [locale]);
  return { locale, t, errorMessage };
}
