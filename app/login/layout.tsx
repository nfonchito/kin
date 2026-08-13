import type { Metadata } from "next";

// The page itself is a client component and can't export metadata, so the
// title lives here. Without it every auth page shared the root default and
// two open tabs were indistinguishable.
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Kin household.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
