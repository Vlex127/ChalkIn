import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ChalkIn";
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
          background: "#0a0a0a",
          color: "#fafafa",
          fontSize: 64,
          fontWeight: 600,
        }}
      >
        ChalkIn
      </div>
    ),
    { ...size }
  );
}
