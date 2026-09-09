"use client";

import { useLocale } from "@/lib/i18n";

export function LanguageControl() {
  const { locale, setLocale } = useLocale();
  return (
    <div role="group" aria-label={locale === "th" ? "ภาษา" : "Language"} className="inline-flex rounded-full border border-border/60 bg-surface p-0.5">
      {(["th", "en"] as const).map((language) => (
        <button key={language} type="button" lang={language} aria-label={language === "th" ? "ภาษาไทย" : "English"} aria-pressed={locale === language} onClick={() => setLocale(language)} className="min-h-11 min-w-11 rounded-full px-2 text-sm font-semibold text-muted-ink hover:text-ink aria-pressed:bg-primary aria-pressed:text-primary-ink">
          {language === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}
