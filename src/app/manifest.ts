import type { MetadataRoute } from "next";

// Next.js 15 manifest convention. Served at /manifest.webmanifest.
// Theme + background match the dark/light themeColor in src/app/layout.tsx
// viewport export and the brand-teal gradient used by apple-icon.tsx +
// opengraph-image.tsx, so the splash screen and "Add to Home Screen"
// preview match the rest of the app's identity.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kinroster",
    short_name: "Kinroster",
    description:
      "Voice-first documentation for residential care homes. Caregivers speak; AI structures; families and clinicians stay informed.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0e7c7a",
    categories: ["medical", "productivity", "health"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
