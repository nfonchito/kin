import { ImageResponse } from "next/og";

export const runtime = "edge";

// 512×512 maskable icon for PWA install. Full-bleed teal so the platform
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
          background: "#15c489",
        }}
      >
        <svg width="300" height="300" viewBox="0 0 40 40" fill="none">
          <path
            d="M12 10v20M12 20l10-10M12 20l10 10"
            stroke="#090907"
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
