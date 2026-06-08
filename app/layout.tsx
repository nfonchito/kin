import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kin — Family Assistant",
  description: "AI-powered family assistant for Northwest Hills families",
  icons: {
    icon: "/favicon.svg",
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
