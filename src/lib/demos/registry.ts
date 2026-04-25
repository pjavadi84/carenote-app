// Central registry for landing-page demos. Add new demos by creating a
// folder under src/lib/demos/<demo-id>/ that exports a DemoDefinition,
// then register it in DEMOS below. The registry is intentionally a plain
// in-code map — we want type safety, fast access, and no runtime config
// drift between environments.
//
// Adding a new version of an existing demo:
//   1. Implement the new version (component, scripted data, etc.).
//   2. Append a DemoVersion entry to the demo's versions[] array.
//   3. To make it live, set the demo's activeVersionId to the new id and
//      set status to "active".
//
// Disabling a demo without deleting code:
//   Set its status to "disabled". Both the UI and the corresponding API
//   route check isDemoActive() before doing any work.

import { consultDemo } from "./consult";
import type { DemoDefinition, DemoVersion } from "./types";

export const DEMOS: Record<string, DemoDefinition> = {
  [consultDemo.id]: consultDemo,
};

export function getDemo(id: string): DemoDefinition | undefined {
  return DEMOS[id];
}

export function isDemoActive(id: string): boolean {
  const demo = DEMOS[id];
  return Boolean(
    demo && demo.status === "active" && demo.activeVersionId !== null
  );
}

export function getActiveVersion(id: string): DemoVersion | undefined {
  const demo = DEMOS[id];
  if (!demo || demo.status !== "active" || !demo.activeVersionId) {
    return undefined;
  }
  return demo.versions.find((v) => v.id === demo.activeVersionId);
}
