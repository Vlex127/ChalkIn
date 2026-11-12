import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ChalkIn — Offline attendance for Nigerian universities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Auto-generated share-card image — no design file needed. Next.js serves
// this at /opengraph-image and next/link previews, Twitter, Slack, iMessage
// etc. all pick it up automatically via the metadata in layout.tsx.
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#0a0a0a",
          color: "#fafafa",
          padding: 48,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: "-0.02em" }}>
          ChalkIn
        </div>
        <div style={{ fontSize: 30, color: "#a3a3a3" }}>
          Offline attendance for Nigerian universities
        </div>
      </div>
    ),
    { ...size }
  );
}
