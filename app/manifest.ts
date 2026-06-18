import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kin — Family Assistant",
    short_name: "Kin",
    description: "A personal assistant for busy families — tasks, reminders, and your family calendar in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#090907",
    theme_color: "#090907",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/manifest-icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/manifest-icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
