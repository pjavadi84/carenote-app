import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyVapiWebhook, type VapiWebhookEvent } from "@/lib/vapi";
import { callClaude, parseJsonResponse } from "@/lib/claude";
import { redactPhiText } from "@/lib/redaction";
import { incrementUsage } from "@/lib/quota";
import { getResidentContext } from "@/lib/i18n/locale";
import { structureNote } from "@/lib/services/structure-note";
import type { Json } from "@/types/database";
import {
  VOICE_SANITY_SYSTEM_PROMPT,
  VOICE_SANITY_MODEL,
  buildVoiceSanityUserPrompt,
  type VoiceSanityOutput,
} from "@/lib/prompts/voice-sanity";

// Look up our voice_sessions row using either metadata.sessionId (preferred)
// or vapi_call_id as fallback.
async function findSession(
  supabase: ReturnType<typeof createAdminClient>,
  event: VapiWebhookEvent
) {
  const sessionId =
    event.call.assistantOverrides?.metadata?.sessionId ??
    event.call.metadata?.sessionId;
  if (sessionId) {
    const { data } = await supabase
      .from("voice_sessions")
      .select("id, organization_id, resident_id, caregiver_id")
      .eq("id", sessionId)
      .single();
    return data as {
      id: string;
      organization_id: string;
      resident_id: string;
      caregiver_id: string;
    } | null;
  }
  // Fallback: lookup by vapi_call_id
  const { data } = await supabase
    .from("voice_sessions")
    .select("id, organization_id, resident_id, caregiver_id")
    .eq("vapi_call_id", event.call.id)
    .single();
  return data as {
    id: string;
    organization_id: string;
    resident_id: string;
    caregiver_id: string;
  } | null;
}

// Runs alongside structuring to flag obviously off-topic content in the
// raw transcript. Returns null on any failure (including parse errors);
// callers must treat a missing warning as "no known concerns", not
// "clean".
async function runVoiceSanity(
  transcript: string
): Promise<VoiceSanityOutput | null> {
  try {
    // Redact at the LLM boundary — the raw transcript stays in
    // voice_transcripts as the source of truth.
    const raw = await callClaude({
      model: VOICE_SANITY_MODEL,
      systemPrompt: VOICE_SANITY_SYSTEM_PROMPT,
      userPrompt: buildVoiceSanityUserPrompt(redactPhiText(transcript)),
      maxTokens: 400,
    });
    const parsed = parseJsonResponse<VoiceSanityOutput>(raw);
    if (!parsed || typeof parsed.has_concerns !== "boolean") return null;
    return {
      has_concerns: parsed.has_concerns,
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.slice(0, 4)
        : [],
      excerpts: Array.isArray(parsed.excerpts)
        ? parsed.excerpts.slice(0, 3).map((e) => String(e).slice(0, 160))
        : [],
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!verifyVapiWebhook(request)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = (await request.json()) as { message: VapiWebhookEvent };
  const event = payload.message;

  if (!event?.type) {
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  if (event.type === "status-update") {
    const session = await findSession(supabase, event);
    if (session) {
      const status = event.status === "in-progress" ? "in_progress" : event.status === "ended" ? "completed" : null;
      if (status) {
        await supabase
          .from("voice_sessions")
          .update({
            status,
            vapi_call_id: event.call.id,
            ...(status === "in_progress" ? { started_at: new Date().toISOString() } : {}),
          })
          .eq("id", session.id);
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "end-of-call-report") {
    const session = await findSession(supabase, event);

    if (!session) {
      return NextResponse.json({ error: "Session not found for call" }, { status: 404 });
    }

    const transcript = event.transcript || (event.messages ?? []).map((m) => `${m.role}: ${m.message ?? ""}`).join("\n");

    await supabase
      .from("voice_sessions")
      .update({
        status: "completed",
        vapi_call_id: event.call.id,
        ended_at: event.endedAt || new Date().toISOString(),
        duration_seconds: event.durationSeconds ?? null,
        full_transcript: transcript,
      })
      .eq("id", session.id);

    if (event.messages?.length) {
      const turns = event.messages
        .filter((m) => m.message && m.role !== "tool")
        .map((m) => ({
          session_id: session.id,
          role: m.role,
          text: m.message!,
          offset_ms: m.secondsFromStart ? Math.round(m.secondsFromStart * 1000) : null,
        }));
      if (turns.length) {
        await supabase.from("voice_transcripts").insert(turns);
      }
    }

    if (!transcript.trim()) {
      return NextResponse.json({ received: true, skipped: "empty transcript" });
    }

    // Resident is sanity-checked here so we can short-circuit a missing
    // record before queueing structuring. Author name is looked up inside
    // structureNote(); org is needed for the retain_transcripts setting.
    const [{ data: resident }, { data: org }] = await Promise.all([
      supabase
        .from("residents")
        .select("first_name, last_name")
        .eq("id", session.resident_id)
        .single(),
      supabase
        .from("organizations")
        .select("settings")
        .eq("id", session.organization_id)
        .single(),
    ]);

    if (!resident) {
      return NextResponse.json({ received: true, skipped: "resident missing" });
    }

    const orgSettings = (org as { settings: Record<string, unknown> | null } | null)
      ?.settings ?? {};
    const retainTranscripts = orgSettings.retain_transcripts !== false; // default retain

    const shiftFromHour = (() => {
      const h = new Date().getHours();
      if (h < 12) return "morning";
      if (h < 18) return "afternoon";
      return "night";
    })();

    const { data: noteRow } = await supabase
      .from("notes")
      .insert({
        organization_id: session.organization_id,
        resident_id: session.resident_id,
        author_id: session.caregiver_id,
        note_type: "shift_note",
        raw_input: transcript,
        shift: shiftFromHour,
        metadata: { source: "voice_call", voice_session_id: session.id },
      })
      .select("id, created_at")
      .single();

    const note = noteRow as { id: string; created_at: string } | null;
    if (!note) {
      return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
    }

    await supabase
      .from("voice_sessions")
      .update({ note_id: note.id })
      .eq("id", session.id);

    // Locale context for multilingual structuring. Existing US/HIPAA orgs
    // with no demographic fields populated still produce identical English
    // output — buildCulturalRegisterBlock returns minimal/empty blocks when
    // fields are unset.
    //
    // Failure here must NOT bubble: if it does, the note row exists with
    // raw_input but structuring never runs, leaving the note stuck "Pending"
    // with no structuring_error to debug from. Treat any failure as "no
    // locale context" and let structureNote proceed with English defaults.
    let localeContext = null;
    try {
      localeContext = await getResidentContext(session.resident_id);
    } catch (err) {
      console.error(
        "voice/webhook: getResidentContext failed, falling back to defaults",
        { residentId: session.resident_id, error: err }
      );
    }

    // Structuring and voice-sanity run in parallel. Sanity is informational
    // and never blocks — if it fails we just omit the warning. Structuring
    // goes through the shared structureNote service so attempt-counting,
    // give-up, and outbound-edited_output rules stay in one place.
    const [structureResult, sanityResult] = await Promise.allSettled([
      structureNote(supabase, note.id, {
        localeContext,
        extraMetadata: {
          source: "voice_call",
          voice_session_id: session.id,
        },
      }),
      runVoiceSanity(transcript),
    ]);

    if (
      structureResult.status === "fulfilled" &&
      structureResult.value.success
    ) {
      incrementUsage(session.organization_id, "ai").catch(() => {});

      // If sanity flagged concerns, fold them into metadata as a follow-up
      // update so they're visible to the caregiver UI.
      const overCaptureWarning =
        sanityResult.status === "fulfilled" &&
        sanityResult.value &&
        sanityResult.value.has_concerns
          ? sanityResult.value
          : null;

      if (overCaptureWarning) {
        const { data: noteAfter } = await supabase
          .from("notes")
          .select("metadata")
          .eq("id", note.id)
          .single();
        const existingMetadata =
          (noteAfter as { metadata: Record<string, unknown> | null } | null)
            ?.metadata ?? {};
        await supabase
          .from("notes")
          .update({
            metadata: {
              ...existingMetadata,
              over_capture_warning: overCaptureWarning as unknown as Json,
            } as Json,
          })
          .eq("id", note.id);
      }

      // Retention cleanup. Runs after the note carries the finalized
      // structured_output so the raw transcript is no longer needed for
      // downstream processing. notes.raw_input is the source of truth
      // and is kept regardless — the cleanup targets the separately
      // stored voice_transcripts + full_transcript.
      if (!retainTranscripts) {
        await supabase
          .from("voice_transcripts")
          .delete()
          .eq("session_id", session.id);
        await supabase
          .from("voice_sessions")
          .update({ full_transcript: null })
          .eq("id", session.id);
      }
    }

    return NextResponse.json({ received: true, noteId: note.id });
  }

  return NextResponse.json({ received: true });
}
