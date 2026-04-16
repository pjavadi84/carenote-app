import type { NextRequest } from "next/server";

export interface VapiEndOfCallReport {
  type: "end-of-call-report";
  call: {
    id: string;
    metadata?: Record<string, string>;
    assistantOverrides?: { metadata?: Record<string, string> };
  };
  endedReason?: string;
  transcript?: string;
  messages?: Array<{
    role: "assistant" | "user" | "system" | "tool";
    message?: string;
    time?: number;
    secondsFromStart?: number;
  }>;
  durationSeconds?: number;
  startedAt?: string;
  endedAt?: string;
  summary?: string;
}

export interface VapiStatusUpdate {
  type: "status-update";
  call: {
    id: string;
    metadata?: Record<string, string>;
    assistantOverrides?: { metadata?: Record<string, string> };
  };
  status: "queued" | "ringing" | "in-progress" | "forwarding" | "ended";
}

export type VapiWebhookEvent = VapiEndOfCallReport | VapiStatusUpdate;

// Vapi posts webhooks with a shared secret in the x-vapi-secret header.
// That secret is set in the Vapi dashboard's Server URL config.
export function verifyVapiWebhook(request: NextRequest): boolean {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) return false;
  const received = request.headers.get("x-vapi-secret");
  return received === expected;
}

// Build the resident-specific overrides Vapi accepts when starting a call.
// These get merged into the assistant's configured system prompt.
export function buildAssistantOverrides(params: {
  caregiverName: string;
  residentFirstName: string;
  residentLastName: string;
  conditions: string | null;
  careNotesContext: string | null;
}) {
  const { caregiverName, residentFirstName, residentLastName, conditions, careNotesContext } = params;
  return {
    variableValues: {
      caregiver_name: caregiverName,
      resident_first_name: residentFirstName,
      resident_last_name: residentLastName,
      conditions: conditions || "none on file",
      care_context: careNotesContext || "none on file",
    },
  };
}
