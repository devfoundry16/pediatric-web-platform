import React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { defaultLocale } from "@/lib/i18n/config";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "LittleCare - Pediatric Care, Reimagined",
  description:
    "Expert pediatric healthcare in Dubai. Online video consultations, digital medical records, care packages, and educational courses for your child.",
};

export const viewport: Viewport = {
  themeColor: "#2a9d8f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dictionary = await getDictionary(defaultLocale);

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${cairo.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider
            initialLocale={defaultLocale}
            initialDictionary={dictionary}
          >
            <AuthProvider>
              {children}
              <Toaster richColors position="top-center" />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
