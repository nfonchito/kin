import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Set up your household on Kin. Free, no credit card.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
