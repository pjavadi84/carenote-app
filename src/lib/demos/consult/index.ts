import type { DemoDefinition } from "../types";

// AI Consultation demo. The first version wired the landing-page modal to a
// live Whisper + Claude pipeline (/api/demo/consult). Currently disabled
// while the format is being decided — likely future versions will be a
// pre-recorded video or a fully client-side scripted reveal so the demo
// doesn't burn API credits per visitor.
//
// To re-enable: flip status to "active" and set activeVersionId. The modal
// and API route both read from this definition, so flipping these two
// fields is enough.

export const consultDemo: DemoDefinition = {
  id: "consult",
  title: "AI Consultation",
  description:
    "Voice-first care or clinical documentation. Visitor records a short note; the demo shows the structured output.",
  status: "disabled",
  activeVersionId: null,
  versions: [
    {
      id: "v1-live-api",
      label: "Live Whisper + Claude pipeline",
      kind: "live-api",
      notes:
        "Records audio in the browser, sends to /api/demo/consult, which proxies to Whisper and then Claude Haiku 4.5. Disabled to avoid API spend during evaluation.",
      createdAt: "2026-04-25",
    },
  ],
};
