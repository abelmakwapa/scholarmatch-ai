import { ImageResponse } from "next/og";

export const alt = "ScholarMatch AI — Don’t hunt, just match";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#ffffeb",
          color: "#1a1a1a",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "64px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "stretch",
            border: "3px solid #1a1a1a",
            borderRadius: "36px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            padding: "58px 64px",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                alignItems: "center",
                background: "#f0d7ff",
                border: "2px solid #1a1a1a",
                borderRadius: "10px",
                display: "flex",
                height: 42,
                justifyContent: "center",
                marginRight: 16,
                width: 42,
              }}
            >
              S
            </span>
            ScholarMatch AI
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontFamily: "serif",
                fontSize: 105,
                letterSpacing: "-4px",
                lineHeight: 0.9,
              }}
            >
              Don&apos;t hunt,
            </span>
            <span
              style={{
                color: "#593d63",
                fontFamily: "serif",
                fontSize: 105,
                fontStyle: "italic",
                letterSpacing: "-4px",
                lineHeight: 0.9,
              }}
            >
              just match.
            </span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 25,
              justifyContent: "space-between",
            }}
          >
            <span>Explainable scholarship discovery</span>
            <span>Eligibility first →</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
