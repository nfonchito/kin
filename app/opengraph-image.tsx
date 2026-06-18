import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kin — A personal assistant for busy families";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social-share card shown when the Kin link is posted in a message or email.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#090907",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 40 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: "#15c489",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="54" height="54" viewBox="0 0 40 40" fill="none">
              <path
                d="M12 10v20M12 20l10-10M12 20l10 10"
                stroke="#090907"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, color: "#f0efe8", letterSpacing: "-0.02em" }}>
            Kin
          </div>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, color: "#f0efe8", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
          The mental load of running
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
          <span style={{ color: "#f0efe8" }}>a home,&nbsp;</span>
          <span style={{ color: "#15c489" }}>handled.</span>
        </div>
        <div style={{ fontSize: 30, color: "#9b9a92", marginTop: 32 }}>
          Tasks, reminders, and your family calendar — in one place.
        </div>
      </div>
    ),
    { ...size }
  );
}
