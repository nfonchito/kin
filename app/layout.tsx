import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kin — Family Assistant",
    template: "%s · Kin",
  },
  description:
    "Kin is a personal assistant for busy families — it organizes tasks, reminders, and your family calendar so nothing falls through the cracks.",
  applicationName: "Kin",
  keywords: ["family assistant", "household organizer", "family calendar", "reminders", "Kin"],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Kin — Family Assistant",
    description:
      "A personal assistant for busy families. Organize tasks, reminders, and your family calendar in one place.",
    url: siteUrl,
    siteName: "Kin",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kin — Family Assistant",
    description:
      "A personal assistant for busy families. Organize tasks, reminders, and your family calendar in one place.",
  },
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
