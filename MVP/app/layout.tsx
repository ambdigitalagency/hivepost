import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { I18nProvider } from "@/context/I18nContext";
import { SessionProvider } from "@/components/SessionProvider";
import { SignInGoogleTracker } from "@/components/SignInGoogleTracker";
import { getMessages, defaultLocale, type Locale } from "@/lib/i18n";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "HivePost",
  description: "Simple marketing content for your local business.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined) ?? defaultLocale;
  const messages = getMessages(locale === "zh" ? "zh" : "en");

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <SignInGoogleTracker />
          <I18nProvider locale={locale} messages={messages}>
            {children}
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
