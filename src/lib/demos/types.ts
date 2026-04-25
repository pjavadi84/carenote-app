// Shared types for the demo registry. A "demo" is a public-facing,
// landing-page interactive showcase of a Kinroster capability. Each demo can
// have many versions tracked over time, with one (or zero) version marked
// active. The active version is what gets rendered on the site.
//
// Status flow:
//   draft     — being authored, not visible anywhere
//   active    — currently rendered on the site
//   disabled  — temporarily paused (UI hides it, server refuses requests)
//   archived  — kept for reference, no longer surfaced

export type DemoStatus = "draft" | "active" | "disabled" | "archived";

export type DemoKind =
  | "live-api"        // Calls real backend services (Whisper, Claude, etc.)
  | "scripted"        // Pure client-side scripted/animated content
  | "video"           // Pre-recorded video or GIF asset
  | "static";         // Static screenshots / illustrations

export interface DemoVersion {
  // Stable identifier within this demo, e.g. "v1-live-api". Used by the
  // registry to point activeVersionId at a specific version.
  id: string;

  label: string;

  // Free-form notes useful during iteration: cost characteristics, what
  // changed vs. the previous version, why it was retired, etc.
  notes?: string;

  kind: DemoKind;

  // ISO 8601 date the version was authored. Lets us sort versions newest
  // first when listing them in admin views.
  createdAt: string;
}

export interface DemoDefinition {
  // Stable identifier for the demo as a whole, e.g. "consult". URL-safe;
  // used as a key in the registry map.
  id: string;

  title: string;

  description: string;

  status: DemoStatus;

  // The version that should be rendered when status is "active". Null when
  // no version is currently selected (e.g. demo is disabled or no versions
  // have been authored yet).
  activeVersionId: string | null;

  versions: DemoVersion[];
}
