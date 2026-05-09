import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonResponse } from "@/lib/claude";
import {
  FAMILY_UPDATE_SYSTEM_PROMPT,
  buildFamilyUpdateUserPrompt,
  type FamilyUpdateOutput,
} from "@/lib/prompts/family-update";
import {
  parseStructuredOutput,
  filterSectionsForFamily,
  serializeSectionsForPrompt,
} from "@/lib/structured-output";
import { getEffectiveStructuredOutput } from "@/lib/notes/effective-output";
import {
  hasActivePdpaConsent,
  pdpaConsentRequired,
} from "@/lib/pdpa/active-consent";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { residentId, contactId, dateRangeStart, dateRangeEnd } =
    await request.json();

  if (!residentId || !contactId || !dateRangeStart || !dateRangeEnd) {
    return NextResponse.json(
      { error: "residentId, contactId, dateRangeStart, dateRangeEnd required" },
      { status: 400 }
    );
  }

  // Fetch resident
  const { data: resident } = await supabase
    .from("residents")
    .select("first_name, last_name, organization_id")
    .eq("id", residentId)
    .single();

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const typedResident = resident as {
    first_name: string;
    last_name: string;
    organization_id: string;
  };

  // Fetch org (name + PDPA-gating setting).
  const { data: org } = await supabase
    .from("organizations")
    .select("name, settings")
    .eq("id", typedResident.organization_id)
    .single();

  const typedOrg = org as
    | { name: string; settings: Record<string, unknown> | null }
    | null;

  // PDPA gate: if the org opted into hard-blocking on missing consent
  // (settings.pdpa_consent_required), refuse to generate any AI-drafted
  // family update for residents without an active consent record. Off by
  // default so existing orgs aren't broken; Taiwan orgs flip it on once
  // they're capturing consent for every resident.
  if (pdpaConsentRequired(typedOrg?.settings)) {
    const consented = await hasActivePdpaConsent(supabase, residentId);
    if (!consented) {
      return NextResponse.json(
        {
          error:
            "PDPA consent missing. Capture a resident_pdpa_consents record before generating family updates for this resident.",
          code: "pdpa_consent_required",
        },
        { status: 403 }
      );
    }
  }

  // Fetch contact with the authorization fields needed for Phase 3 filtering.
  const { data: contact } = await supabase
    .from("family_contacts")
    .select(
      "name, relationship, involved_in_care, personal_representative, authorization_on_file, authorization_scope"
    )
    .eq("id", contactId)
    .single();

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const typedContact = contact as {
    name: string;
    relationship: string;
    involved_in_care: boolean;
    personal_representative: boolean;
    authorization_on_file: boolean;
    authorization_scope: string[];
  };

  // Fetch notes in date range. Pull both columns so caregiver edits via
  // `edited_output` reach the family-facing prompt rather than the original
  // AI draft. NOTE: a family update sent before a late edit is not re-sent
  // — versioned/notification on edit is a separate, deferred change.
  const { data: notesData } = await supabase
    .from("notes")
    .select("id, created_at, structured_output, edited_output, author_id")
    .eq("resident_id", residentId)
    .eq("is_structured", true)
    .gte("created_at", dateRangeStart)
    .lte("created_at", dateRangeEnd + "T23:59:59Z")
    .order("created_at", { ascending: true });

  const notes = (notesData ?? []) as Array<{
    id: string;
    created_at: string;
    structured_output: string | null;
    edited_output: string | null;
    author_id: string;
  }>;

  if (notes.length === 0) {
    return NextResponse.json(
      { error: "No structured notes found in this date range" },
      { status: 400 }
    );
  }

  // Fetch author names
  const authorIds = [...new Set(notes.map((n) => n.author_id))];
  const { data: authors } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", authorIds);

  const authorMap = new Map(
    ((authors ?? []) as Array<{ id: string; full_name: string }>).map((a) => [
      a.id,
      a.full_name,
    ])
  );

  // Phase 3: filter each note's sections by the contact's legal basis and
  // authorization scope. Sections classed as care_team_only, billing_ops_only,
  // or sensitive_restricted never reach family-facing prompts.
  const filteredNotes = notes
    .map((n) => {
      const effective = getEffectiveStructuredOutput(n);
      if (!effective) return null;
      const parsed = parseStructuredOutput(effective);
      if (!parsed) return null;
      const allowed = filterSectionsForFamily(parsed.sections, {
        involved_in_care: typedContact.involved_in_care,
        personal_representative: typedContact.personal_representative,
        authorization_on_file: typedContact.authorization_on_file,
        authorization_scope: typedContact.authorization_scope,
      });
      if (allowed.length === 0) return null;
      return {
        id: n.id,
        created_at: n.created_at,
        author_id: n.author_id,
        structured_output: serializeSectionsForPrompt(allowed, parsed.follow_up),
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  if (filteredNotes.length === 0) {
    return NextResponse.json(
      {
        error:
          "No shareable content in this date range for this contact. Review the contact's authorization scope and legal basis.",
      },
      { status: 400 }
    );
  }

  try {
    const raw = await callClaude({
      systemPrompt: FAMILY_UPDATE_SYSTEM_PROMPT,
      userPrompt: buildFamilyUpdateUserPrompt({
        facilityName: typedOrg?.name || "Our Facility",
        residentFirstName: typedResident.first_name,
        residentLastName: typedResident.last_name,
        familyContactName: typedContact.name,
        relationship: typedContact.relationship,
        dateRangeStart,
        dateRangeEnd,
        notes: filteredNotes.map((n) => ({
          created_at: n.created_at,
          author_name: authorMap.get(n.author_id) || "Staff",
          structured_output: n.structured_output,
        })),
      }),
      maxTokens: 1024,
    });

    const update = parseJsonResponse<FamilyUpdateOutput>(raw);

    return NextResponse.json({
      subject: update.subject,
      body: update.body,
      sourceNoteIds: filteredNotes.map((n) => n.id),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate family update", details: message },
      { status: 500 }
    );
  }
}
