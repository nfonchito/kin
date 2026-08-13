import { ImageResponse } from "next/og";

export const runtime = "edge";

// 512×512 maskable icon for PWA install. Full-bleed accent so the platform
// mask only ever crops the background, never the mark.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6bd7c",
        }}
      >
        <svg width="300" height="300" viewBox="0 0 40 40" fill="none">
          <path
            d="M12 10v20M12 20l10-10M12 20l10 10"
            stroke="#4a3a24"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
