import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

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
  const theme = (await cookies()).get("deledger_theme")?.value;
  const resolvedTheme = theme === "light" || theme === "dark" ? theme : null;

  return (
    <html lang="th" data-theme={resolvedTheme ?? undefined}>
      <body>{children}</body>
    </html>
  );
}
