import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// App icon — the Kin "K" mark rendered as a PNG so it works everywhere
// (browser tabs, PWA install, home screen).
export default function Icon() {
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
          borderRadius: 44,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 40 40" fill="none">
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
    { ...size }
  );
}
