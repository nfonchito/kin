import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Send yourself a link to set a new Kin password.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
