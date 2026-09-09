import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Google_Sans } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n";
import { CalendarBoundary } from "@/components/calendar-boundary";
import { localeCookie, resolveLocale } from "@/lib/locale";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["thai", "latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  adjustFontFallback: false,
  variable: "--font-google-sans",
});

export const metadata: Metadata = {
  title: "Deledger",
  description: "Monthly income and expense accounting",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const preferences = await cookies();
  const theme = preferences.get("deledger_theme")?.value;
  const locale = resolveLocale(preferences.get(localeCookie)?.value);
  const resolvedTheme = theme === "light" || theme === "dark" ? theme : null;

  return (
    <html lang={locale} className={googleSans.variable} data-theme={resolvedTheme ?? undefined}>
      <body><LocaleProvider initialLocale={locale}><CalendarBoundary>{children}</CalendarBoundary></LocaleProvider></body>
    </html>
  );
}
