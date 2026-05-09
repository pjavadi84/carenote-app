import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import {
  applyScope,
  EXPORT_DAILY_LIMIT,
  keysForScope,
  policyForRecipient,
  rateLimitDecision,
  validateExportRequest,
  type ExportRecipientType,
  type ExportRequestParams,
  type ExportScope,
} from "@/lib/exports/resident-export";

// F4 #3 — controlled JSON export of a resident's record.
//
// What changed vs. the prior GET-with-no-params route:
//   - Now POST with required body { reason, recipientType, scope,
//     recipientName? }. The reason is recorded verbatim on the
//     audit + disclosure rows; recipientType drives the lawful-basis
//     mapping; scope decides which top-level keys end up in the bundle.
//   - admin-only. compliance_admin used to be allowed and is now NOT —
//     compliance audits the disclosure ledger; they don't pull the
//     ledger's source data themselves. (compliance_admin retains read
//     access to /audit-log etc.)
//   - Rate-limited to EXPORT_DAILY_LIMIT exports / org / 24h. A
//     compromised admin account can't dump the whole facility in
//     seconds.
//   - Disclosure event records the actual lawful basis
//     (patient_request / continuity_of_care / regulatory_request /
//     subpoena_or_court_order / operations) instead of always
//     recording "operations" as before.
//
// Bundle scoping is in-memory: the route loads everything once
// (RLS-scoped by org) and applyScope() decides what gets serialized.
// Cheap because the rows are already in memory; keeps the SQL paths
// simple.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("role, organization_id, full_name, email")
    .eq("id", user.id)
    .single();

  const typedUser = appUser as {
    role: string;
    organization_id: string;
    full_name: string;
    email: string;
  } | null;

  // Admin only. compliance_admin retains read on the audit / disclosure
  // ledgers but cannot pull a resident's PHI bundle.
  if (!typedUser || typedUser.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  let body: Partial<ExportRequestParams>;
  try {
    body = (await request.json()) as Partial<ExportRequestParams>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateExportRequest(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { reason, recipientType, scope, recipientName } =
    body as ExportRequestParams;

  // Daily rate limit: count completed exports in the last 24h for this
  // org, regardless of which resident, regardless of which admin.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", typedUser.organization_id)
    .eq("event_type", "export")
    .eq("object_type", "resident")
    .gte("created_at", since);
  const limit = rateLimitDecision(recentCount ?? 0);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Daily export limit reached (${EXPORT_DAILY_LIMIT}/24h for the org). Try again tomorrow or contact compliance.`,
        code: "rate_limited",
      },
      { status: 429 }
    );
  }

  // Resident (RLS enforces org scope)
  const { data: resident } = await supabase
    .from("residents")
    .select("*")
    .eq("id", id)
    .single();

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const residentRow = resident as {
    id: string;
    first_name: string;
    last_name: string;
    organization_id: string;
  } & Record<string, unknown>;

  // Decide what the bundle CAN contain before we hit the DB so we
  // don't waste round-trips for keys the scope will drop. demographics_only
  // skips most of the related-table loads; clinical_only skips the
  // contact/family-comm side.
  const wantedKeys = new Set(keysForScope(scope as ExportScope));

  const loaders: Record<string, () => Promise<unknown>> = {
    notes: async () =>
      (await supabase.from("notes").select("*").eq("resident_id", id)).data ??
      [],
    family_contacts: async () =>
      (await supabase.from("family_contacts").select("*").eq("resident_id", id))
        .data ?? [],
    treating_clinicians: async () =>
      (
        await supabase
          .from("resident_clinicians")
          .select("*, clinicians(*)")
          .eq("resident_id", id)
      ).data ?? [],
    incident_reports: async () =>
      (
        await supabase
          .from("incident_reports")
          .select("*")
          .eq("resident_id", id)
      ).data ?? [],
    weekly_summaries: async () =>
      (
        await supabase
          .from("weekly_summaries")
          .select("*")
          .eq("resident_id", id)
      ).data ?? [],
    family_communications: async () =>
      (
        await supabase
          .from("family_communications")
          .select("*")
          .eq("resident_id", id)
      ).data ?? [],
    disclosure_events: async () =>
      (
        await supabase
          .from("disclosure_events")
          .select("*")
          .eq("resident_id", id)
      ).data ?? [],
    audit_events: async () =>
      (
        await supabase
          .from("audit_events")
          .select("*")
          .or(
            `metadata->>resident_id.eq.${id},and(object_type.eq.note,object_id.in.(SELECT id FROM notes WHERE resident_id = '${id}'))`
          )
          .limit(1000)
      ).data ?? [],
    voice_sessions: async () =>
      (
        await supabase
          .from("voice_sessions")
          .select("*")
          .eq("resident_id", id)
      ).data ?? [],
    voice_transcripts: async () =>
      (
        await supabase
          .from("voice_transcripts")
          .select("*, voice_sessions!inner(resident_id)")
          .eq("voice_sessions.resident_id", id)
      ).data ?? [],
  };

  const loadedEntries: Array<[string, unknown]> = await Promise.all(
    Object.entries(loaders)
      .filter(([k]) => wantedKeys.has(k))
      .map(async ([k, fn]) => [k, await fn()] as [string, unknown])
  );
  const loaded: Record<string, unknown> = Object.fromEntries(loadedEntries);

  const policy = policyForRecipient(recipientType as ExportRecipientType);

  const fullBundle: Record<string, unknown> = {
    resident: residentRow,
    ...loaded,
  };
  const scoped = applyScope(fullBundle, scope as ExportScope);

  const payload = {
    meta: {
      exported_at: new Date().toISOString(),
      exported_by: {
        id: user.id,
        full_name: typedUser.full_name,
        email: typedUser.email,
      },
      resident_id: id,
      organization_id: residentRow.organization_id,
      reason,
      recipient_type: recipientType,
      recipient_name: recipientName ?? null,
      scope,
      legal_basis: policy.disclosureLegalBasis,
      note:
        "This export represents the resident's record in Kinroster as of " +
        "the export timestamp. Any records added after that time are not " +
        "included. The export act itself is logged on the audit and " +
        "disclosure ledgers.",
      ai_generated_fields: {
        notes: ["structured_output", "edited_output"],
        weekly_summaries: ["summary_text", "key_trends", "concerns"],
        incident_reports: ["report_text"],
        voice_transcripts: ["text"],
        description:
          "Fields listed above are AI-generated from caregiver-entered " +
          "raw input. They are documentation aids and not clinical " +
          "assessments. The corresponding raw_input fields on each note " +
          "are the unedited source of truth.",
      },
    },
    ...scoped,
  };

  // Compute byte count for the audit row so reviewers can see at a
  // glance whether an export was a small extract or a full chart dump.
  const serialized = JSON.stringify(payload, null, 2);
  const byteCount = new TextEncoder().encode(serialized).length;

  // categories_shared is the actual list of top-level keys in this
  // export — driven by the chosen scope.
  const sharedKeys = Object.keys(scoped);

  // Source note IDs (only when notes are in scope).
  const noteIds: string[] = Array.isArray(scoped.notes)
    ? (scoped.notes as Array<{ id: string }>).map((n) => n.id)
    : [];

  await supabase.from("disclosure_events").insert({
    organization_id: residentRow.organization_id,
    resident_id: id,
    actor_user_id: user.id,
    recipient_type: policy.disclosureRecipientType,
    recipient_id: null,
    legal_basis: policy.disclosureLegalBasis,
    categories_shared: sharedKeys,
    source_note_ids: noteIds,
    delivery_method: "pdf_export",
  });

  await logAudit({
    organizationId: residentRow.organization_id,
    userId: user.id,
    eventType: "export",
    objectType: "resident",
    objectId: id,
    request,
    metadata: {
      reason,
      recipient_type: recipientType,
      recipient_name: recipientName ?? null,
      scope,
      legal_basis: policy.disclosureLegalBasis,
      categories_shared: sharedKeys,
      byte_count: byteCount,
      remaining_today: limit.remaining - 1,
    },
  });

  const filename =
    `kinroster-resident-${residentRow.last_name}-${residentRow.first_name}-${new Date()
      .toISOString()
      .slice(0, 10)}-${scope}.json`
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, "-");

  return new NextResponse(serialized, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
