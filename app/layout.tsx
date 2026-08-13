import type { Metadata, Viewport } from "next";
import "./globals.css";

// Canonical site URL — the owned domain, overridable via env for previews.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kinfamily.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kin — Family Assistant",
    template: "%s · Kin",
  },
  description:
    "Tell Kin what the house needs in plain English. It keeps the calendar, keeps the list, and emails you each morning with what's ahead.",
  applicationName: "Kin",
  keywords: ["family organizer", "household organizer", "family calendar", "reminders", "Kin"],
  // "default" now the app is light — black-translucent was for the dark theme.
  appleWebApp: { capable: true, title: "Kin", statusBarStyle: "default" },
  openGraph: {
    title: "Kin — Family Assistant",
    description:
      "Tell Kin what the house needs in plain English. It keeps the calendar and emails you each morning with what's ahead.",
    url: siteUrl,
    siteName: "Kin",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kin — Family Assistant",
    description:
      "Tell Kin what the house needs in plain English. It keeps the calendar and emails you each morning with what's ahead.",
  },
};

export const viewport: Viewport = {
  themeColor: "#fdf6e8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bg text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
