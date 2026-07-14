import type { MetadataRoute } from "next";

const BASE = "https://kinfamily.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, priority: 1 },
    { url: `${BASE}/signup`, priority: 0.8 },
    { url: `${BASE}/login`, priority: 0.5 },
    { url: `${BASE}/privacy`, priority: 0.3 },
    { url: `${BASE}/terms`, priority: 0.3 },
  ];
}
