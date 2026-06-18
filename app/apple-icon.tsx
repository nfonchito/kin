import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon (iOS home screen). Full-bleed — iOS rounds the corners.
export default function AppleIcon() {
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
        <svg width="110" height="110" viewBox="0 0 40 40" fill="none">
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
