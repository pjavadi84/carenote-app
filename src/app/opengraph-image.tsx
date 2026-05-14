import { ImageResponse } from "next/og";

export const alt =
  "Kinroster — Voice-First Documentation for Care Homes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_TEAL = "#0e7c7a";
const BRAND_TEAL_DARK = "#063f3e";
const SURFACE = "#ffffff";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: `linear-gradient(135deg, ${BRAND_TEAL_DARK} 0%, ${BRAND_TEAL} 100%)`,
          color: SURFACE,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -0.5 }}>
            Kinroster
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 980,
            }}
          >
            Voice-First Documentation for Care Homes
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.3,
              opacity: 0.9,
              maxWidth: 980,
            }}
          >
            Turn caregiver voice notes into structured shift logs, incident
            reports, and family updates in seconds.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            opacity: 0.85,
          }}
        >
          <span>HIPAA-ready · Audit ledgers · 42 CFR Part 2</span>
          <span>kinroster.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
