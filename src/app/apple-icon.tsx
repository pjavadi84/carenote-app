import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BRAND_TEAL = "#0e7c7a";
const BRAND_TEAL_DARK = "#063f3e";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${BRAND_TEAL_DARK} 0%, ${BRAND_TEAL} 100%)`,
          color: "#ffffff",
          fontFamily: "sans-serif",
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        K
      </div>
    ),
    { ...size },
  );
}
