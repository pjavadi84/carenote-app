# CareNote HIPAA Compliance Roadmap

## Why this exists

CareNote creates, stores, transmits, and routes electronic protected health information (ePHI). Before it can be used with real patient data, the app needs the compliance primitives that HIPAA (treatment/payment/operations rules, minimum-necessary standard, narrower family-sharing rules) and 42 CFR Part 2 (substance-use records) require.

This document is the engineering source of truth for that work. It was written from a comprehensive compliance spec that outlined the full target state, adapted to what CareNote already has and what it needs to build. Every phase below is scoped as a standalone slice that can ship independently; the order reflects dependency and risk, not feature priority.

The legal analysis behind this roadmap still needs review by qualified healthcare counsel before any org uses the app with real PHI. The code gets you ready; the BAAs and legal review get you live.

## Status at a glance

| Phase | Scope | Status | Dev estimate | Blocking for prod PHI? |
|-------|-------|--------|--------------|-----------------------|
| 1 | Clinician directory + secure sharing | **Shipped** (commit d907d25) | — | Not blocking but highest value |
| 2 | Family authorization & consent | Planned | 2-3 days | Yes |
| 3 | Disclosure classification tags | Planned | 3-4 days | Yes |
| 4 | Sensitive-data segmentation (42 CFR Part 2) | Planned | 2-3 days | Yes |
| 5 | Audit events | Planned | 3-4 days | Yes |
| 6 | Role expansion & minimum-necessary | Planned | 3-5 days | No |
| 7 | Session controls & rate limiting | Planned | 2-3 days | Yes |
| 8 | Data subject rights (export + deletion) | Planned | 3-4 days | Yes |
| 9 | Voice & transcript retention | Planned | 1-2 days | No |
| 10 | Compliance ops (BAAs, runbook, counsel) | Ongoing | Non-code | **Yes** |

Remaining dev time: ~19-28 days. Phase 10 runs in parallel throughout.

## Conventions every phase must follow

Before writing a migration or an API route, know these:

1. **Migrations** are numbered and immutable. Next migration is `supabase/migrations/00006_*.sql`. Never modify a prior migration.
2. **RLS before policies.** `CREATE TABLE ...` → `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` → policies. Enabling RLS after policy creation leaves a window where rows are readable.
3. **All DB functions** pin `SET search_path = public` (or `''`). See `supabase/migrations/00002_secure_functions.sql` for the canonical pattern.
4. **Org-scoped reads + admin-only writes** is the default RLS pattern. Helpers: `get_user_org_id()`, `is_admin()`. See `supabase/migrations/00001_initial_schema.sql:215-224`.
5. **Service-role client** (`src/lib/supabase/admin.ts`) bypasses RLS. Use ONLY in webhooks, crons, and unauthenticated portal endpoints. Never import from client code.
6. **Append-only tables** (audit, disclosure, authorization changes) get INSERT + SELECT policies but no UPDATE/DELETE policies. RLS blocks by default.
7. **Types** live in `src/types/database.ts` (generated). After a migration: apply it (`supabase db reset`), then `supabase gen types typescript --local > src/types/database.ts`. If Docker is unavailable, augment the file manually with the same shape the generator produces — the next regen overwrites without semantic drift.
8. **Prompts** live in `src/lib/prompts/<name>.ts` with three exports: `SYSTEM_PROMPT` constant, `buildUserPrompt()` function, `Output` interface.
9. **Claude calls** go through `callClaude()` in `src/lib/claude.ts` which handles retry, timeout, and parse. Use `parseJsonResponse<T>()` to strip markdown fences.
10. **UI components** use shadcn via `src/components/ui/*`. Dialog trigger uses `render={<Button />}` pattern (the `@base-ui/react` library — no `asChild`).
11. **Role gating.** Server pages: `await requireAdmin()` from `src/lib/auth.ts`. API routes: check `appUser.role !== 'admin'` explicitly if needed. RLS enforces at the DB layer regardless.

---

## Phase 1 — Clinician directory + secure clinician sharing ✅

**Shipped in commit d907d25.** Admins can now share a clinician-formatted summary of one resident's notes with that resident's treating physician via a magic-link portal. Every disclosure is logged.

### What was built

**Migration — `supabase/migrations/00005_clinicians.sql`**
- `clinicians` — org-level directory (full_name, email, phone, specialty, npi, notes, is_active)
- `resident_clinicians` — many-to-many assignment with relationship type (primary_care | specialist | hospice | psychiatric | other) and is_primary flag
- `clinician_share_links` — magic-link tokens: token_hash (SHA-256), share_scope (JSONB), rendered_summary (JSONB snapshot), expires_at, revoked_at, first_opened_at, last_opened_at, open_count, created_by. The unsigned token value is never stored.
- `disclosure_events` — append-only audit: recipient_type, legal_basis, categories_shared, source_note_ids, delivery_method, share_link_id. No UPDATE/DELETE policies.

**Claude prompt — `src/lib/prompts/clinician-summary.ts`**
Clinical register. Outputs `{ subject, body, key_observations[], medication_adherence, safety_events[], cognitive_changes, follow_up_recommended[] }`. Sonnet 4.6 via `callClaude()`.

**API routes**
- `POST /api/share/clinician` — renders summary, generates unsigned token, stores SHA-256 hash + frozen summary snapshot on the share link row, inserts `disclosure_events` (legal_basis=`treatment`, delivery_method=`magic_link_portal`), sends Resend email containing link only.
- `GET /api/portal/clinician/[token]` — unauthenticated, service-role lookup, records open event, returns frozen summary. 410 on revoked/expired.
- `POST /api/share/clinician/[id]/revoke` — admin revoke.

**UI**
- `/clinicians` — admin directory page.
- Treating-clinicians section on `/residents/[id]` with assign/unassign + per-clinician "Share" button.
- Share dialog: scope (date range) → preview (what the clinician will see) → confirm → receipt.
- `/portal/clinician/[token]` — public read-only summary view outside the `(dashboard)` group.
- "Clinicians" link in the admin nav.

**Other touches**
- `src/lib/resend.ts` — added `sendClinicianPortalLink()` (link-only, no PHI in email body).
- `src/lib/supabase/middleware.ts` — `/portal/*` added to public route list.
- `src/types/database.ts` — manually augmented with the four new tables because Docker wasn't running for type regen.

### Known limitations to carry forward

- **Admin-only sharing.** The migration restricts `clinician_share_links` insert to admins. Phase 6 can loosen this to nurse_reviewer once roles expand — caregivers in a 6-20 bed home typically aren't the right actor for clinician disclosures.
- **No segment filtering yet.** The prompt ingests every section of every note in scope. Phase 3 adds `disclosure_class` tags so the clinician summary can exclude `billing_ops_only` and gate `sensitive_restricted` behind an explicit unlock.
- **Email delivery is best-effort.** If Resend fails, the share row still exists (returns 200 with `email_sent: false`) so the admin sees the error. A resend-from-UI action isn't built yet; the admin would revoke + recreate. Add a proper resend endpoint when Phase 5's audit layer lands.
- **No rate limiting.** The portal endpoint accepts unlimited token guesses. Token is 256 bits of entropy so this is mostly academic, but Phase 7 adds per-IP rate limiting to close the gap.
- **Audit events not yet in place.** Phase 1 writes `disclosure_events` on share creation but does not log portal opens to `audit_events` (that table doesn't exist yet). Phase 5 adds that. When Phase 5 lands, revisit `/api/portal/clinician/[token]/route.ts` to insert an audit row on every open.

### How to verify (once Docker is running)

```bash
supabase start
supabase db reset        # applies 00001-00005
pnpm dev
```

Then, as an admin:
1. `/clinicians` → add a clinician with a real email you control.
2. `/residents/[id]` → assign that clinician.
3. Click "Share" → pick a date range that includes at least one structured note → Preview → Confirm.
4. Check the email inbox → open the link → portal renders summary.
5. In the Supabase dashboard (`http://localhost:54323`), verify:
   - `clinician_share_links.open_count` incremented.
   - `disclosure_events` has a row with `legal_basis='treatment'`.
6. From the share row, set `revoked_at=now()` → open the link again → 410.

Cross-org isolation check: log in as a different org's admin → `SELECT * FROM clinicians` returns 0 rows; opening the other org's portal token still works (correct — portal bypasses RLS intentionally).

---

## Phase 2 — Family authorization & consent model

**Goal:** family sharing is gated by explicit authorization per contact, with scope and expiration.

**Why next:** Phase 1 handles the treatment-sharing half (clinicians). Phase 2 handles the narrower family-sharing half — this is where the current app is most at risk today because `family_contacts.receives_updates` is a single boolean with no documented consent basis.

### Scope

**Migration `00006_family_authorizations.sql`** — extend `family_contacts`:
- `involved_in_care BOOLEAN DEFAULT false`
- `personal_representative BOOLEAN DEFAULT false`
- `authorization_on_file BOOLEAN DEFAULT false`
- `authorization_scope TEXT[]` — enum-like strings: `visit_notifications | appointment_logistics | medication_adherence_summary | safety_alerts | wellbeing_summary | task_completion | incident_notifications`
- `communication_channels TEXT[]` — `email | sms | phone`
- `authorization_start_date DATE NULL`
- `authorization_end_date DATE NULL`
- `revoked_at TIMESTAMPTZ NULL`
- `revocation_reason TEXT NULL`
- `confidential_communication_notes TEXT NULL`

Migrate existing rows: `receives_updates=true` → `involved_in_care=true`, `authorization_on_file=false` (agency must review each). Gate new enforcement behind `organizations.settings.family_auth_required` (default false) so the existing family-update flow keeps working in legacy mode during cutover.

**API changes**
- `/api/family/send`: if `settings.family_auth_required=true`, reject sends where target contact has `authorization_on_file=false` OR expired `authorization_end_date` OR `revoked_at IS NOT NULL`.
- Every successful send writes a `disclosure_events` row. Legal basis:
  - `personal_representative=true` → `personal_representative`
  - `authorization_on_file=true` → `patient_authorization`
  - `involved_in_care=true` only → `patient_agreement`

**UI changes**
- Extend `src/components/family/family-contact-form.tsx` (actually `src/components/residents/family-contact-list.tsx` per current code) with authorization fields.
- Revocation button requires a reason text.
- `src/components/family/family-update-editor.tsx` gets a preview screen showing approved scopes only. Out-of-scope sections render as placeholder until Phase 3 adds content-level filtering.

### Verification
- Toggle `settings.family_auth_required` on an org.
- Contact with no authorization → send returns 403.
- Contact with expired auth → rejected.
- Revoked contact → doesn't appear in recipient picker.
- `disclosure_events.legal_basis` is correct per case.

---

## Phase 3 — Disclosure classification tags on note segments

**Goal:** every section of a structured note carries a `disclosure_class` so share flows can filter deterministically instead of relying on Claude to re-judge per audience.

### Scope

**Prompt change** — `src/lib/prompts/shift-note.ts` emits per-section classification:
```ts
{
  summary: string,
  sections: Array<{
    name: string,
    text: string,
    disclosure_class:
      | "care_team_only"
      | "family_shareable_by_authorization"
      | "family_shareable_by_involvement"
      | "billing_ops_only"
      | "sensitive_restricted"
  }>,
  follow_up: string,
  flags: Array<{type, reason}>,
  sensitive_flag: boolean,
  sensitive_category: string | null   // "substance_use_42cfr_part2" | "psychotherapy_notes" | ...
}
```

This is a **breaking shape change** — current shape is `sections: Record<string, string>`. Migration strategy: `organizations.settings.structured_output_version: 'v1' | 'v2'`. Structurer writes whichever shape the org is on; the timeline renderer handles both via type guard. Flip default after all orgs migrate.

**Migration `00007_structured_output_tags.sql`** adds `notes.sensitive_flag BOOLEAN DEFAULT false` and `notes.sensitive_category TEXT NULL`. Re-extract from Claude response in `src/app/api/claude/structure/route.ts`.

**Share flow changes**
- Clinician share: include everything except `billing_ops_only`. Require admin unlock for `sensitive_restricted` (writes an audit event).
- Family update: only include sections where `disclosure_class` maps to a class in the contact's `authorization_scope`.
- Timeline UI: render a colored badge per section indicating its class.

### Verification
- Fall note → "Safety" section tagged `care_team_only`.
- Alcohol mention → `sensitive_flag=true`, category `substance_use_42cfr_part2`.
- Clinician share excludes billing sections unless explicitly unlocked.
- Family update only shows sections mapped to the contact's scope.

### Depends on
- Phase 1 (clinician share filter logic updates)
- Phase 2 (scope-based filtering for family)

---

## Phase 4 — Sensitive-data segmentation (42 CFR Part 2 + psychotherapy)

**Goal:** sensitive notes are behind an explicit per-user access gate with confirmation warnings.

### Scope

**Migration `00008_sensitive_segmentation.sql`**:
- `notes_sensitive_access (id, user_id, resident_id, granted_by, granted_at, expires_at, reason)` — per-user grants.
- Stricter RLS on notes: sensitive rows (`sensitive_flag=true`) only visible if user has an active grant OR is the note's author OR is `compliance_admin` (Phase 6 role).

**UI**
- Red banner on any sensitive note in timeline and detail view.
- Share flows: unlock confirmation dialog listing category + legal rationale. Unlock writes an audit event.
- `/settings/sensitive-access` admin page to grant/revoke.

### Verification
- Caregiver who didn't write a sensitive note can't see it; timeline shows "[sensitive — restricted]".
- Grant access → visible with banner.
- Share with unlock → `disclosure_events.metadata.sensitive_override=true`.

### Depends on
- Phase 3 (`sensitive_flag` on notes)

---

## Phase 5 — Audit events

**Goal:** every PHI access, edit, disclosure, and failed access attempt is logged immutably. This is the "accounting of disclosures" HIPAA requires.

### Scope

**Migration `00009_audit_events.sql`**:
- `audit_events (id, organization_id, user_id, event_type, object_type, object_id, result, ip_address, user_agent, metadata, created_at)`
- Event types: `login_success | login_failure | logout | session_expired | note_view | note_create | note_update | note_delete | audio_capture_start | audio_capture_end | transcript_create | transcript_edit | share_create | share_open | share_revoke | authorization_create | authorization_update | authorization_revoke | permission_change | export | sensitive_access_grant | sensitive_access_revoke | failed_access`
- RLS: compliance_admin SELECT within org; INSERT from service-role; NO UPDATE/DELETE policies → append-only.

**Trigger strategy**
- `BEFORE INSERT/UPDATE/DELETE` triggers on every PHI table insert into `audit_events`. Wrap in `SET search_path = ''`.
- View/read events can't be triggered on SELECT. Wrap reads in `src/lib/supabase/audited-query.ts` that batches audit inserts.
- Middleware catches 401/403 on `/api/*` → `failed_access` event.

**Retrofits required**
- `/api/portal/clinician/[token]/route.ts` → audit each open as `share_open`.
- `/api/share/clinician/[id]/revoke/route.ts` → audit as `share_revoke`.
- Login flow (Supabase auth callback + middleware) → `login_success` / `login_failure` / `logout`.

**UI**
- `/audit-log` — compliance_admin filterable table (date range, user, event_type, resident, object). CSV export.

### Verification
- Login → `login_success` with IP + UA.
- Open a clinician share link → `share_open`.
- Cross-org access attempt → `failed_access`.
- `UPDATE audit_events SET ...` as admin → 0 rows affected (RLS blocks).

---

## Phase 6 — Role expansion & minimum-necessary gating

**Goal:** roles beyond admin/caregiver, with per-role access matrices matching the compliance spec.

### Scope

**Migration `00010_expanded_roles.sql`**
- `users.role` enum adds: `nurse_reviewer | ops_staff | billing_staff | compliance_admin`.
- Seed-migrate: current `admin` → `compliance_admin` (keeps all powers). Decide whether a narrower `admin` role still exists or the old one is fully replaced.
- Rewrite `is_admin()` helper as `has_role(role_name text)`. Keep old `is_admin()` as alias for backwards compatibility.
- Update every RLS policy using `is_admin()` to the role check appropriate for that operation.

**Caregiver assignment** — new `caregiver_assignments (id, caregiver_id, resident_id, start_date, end_date, created_by)`. Extend notes RLS: caregivers only see notes for assigned residents.

**Per-role matrix**
| Role | Clinical notes | Sharing | Admin | Audit log | Billing |
|------|---------------|---------|-------|-----------|---------|
| caregiver | Assigned residents (read/write) | No | No | No | No |
| nurse_reviewer | All notes (read, edit flags) | Create shares | No | No | No |
| ops_staff | Demographics + schedules only | No | No | No | No |
| billing_staff | Demographics + service dates | No | No | No | Full |
| compliance_admin | All | All | All | Full | No |

**Code updates**
- `src/lib/auth.ts` — `requireRole(roles: Role[])`.
- Every `requireAdmin()` call migrated to `requireRole([...])`.
- Navigation becomes role-aware in `src/components/layout/app-shell.tsx`.

### Verification

Per-role smoke test matrix. Critical: verify RLS blocks at DB layer, not just the app layer — attempt operations via direct Supabase client calls to confirm defense-in-depth.

### Not blocking prod PHI
This is a scale/multi-tenant concern. Admin + caregiver works fine for 6-20 bed home rollout. Defer if market signals don't demand it.

---

## Phase 7 — Session controls & rate limiting

**Goal:** session timeout, reauth for sensitive actions, rate limiting on portals and logins.

### Scope

**Session timeout** (idle 15 min default, configurable per org via `settings.session_idle_minutes`) in `src/lib/supabase/middleware.ts`. Compare `session.last_seen_at` cookie vs now. Expire → redirect `/login?reason=timeout`, audit `session_expired`.

**Reauth** for sharing, granting sensitive access, role changes, revoking authorization. `src/lib/auth/reauth.ts` with `requireRecentAuth(minutesAgo: number)`. On stale → 401 with `reauth_required=true`. UI modal password prompt.

**Rate limiting**
- Portal (`/api/portal/clinician/[token]`): 10 opens/min per token, 60/min per IP.
- Login: 5 attempts / 15 min per IP + per email.
- Backend: Upstash Redis (free tier) or DB-backed window table `rate_limit_windows`.

### Verification
- Idle 16 min → redirect on next action + audit event.
- Share after 10 min since login → reauth modal.
- Hammer portal with wrong tokens → 429.

---

## Phase 8 — Data subject rights (export + deletion)

**Goal:** fulfill HIPAA individual-rights requests.

### Scope

**Export**
- `POST /api/residents/[id]/export` (compliance_admin) → background job generates ZIP: profile JSON, notes (raw + structured) JSON + PDF, incidents, family communications, disclosure events, audit events involving this resident. Upload to Supabase Storage with 24h signed URL. Email when ready.
- `POST /api/users/[id]/export` — user's own activity.

**Deletion**
- `DELETE /api/residents/[id]` — soft-delete (`status='deleted_pending'`). Hard-delete cron runs after 30 days unless reversed. Cascades to notes/incidents/family/voice. Keeps a tombstone in `deletion_ledger` (date, reason, actor, resident hash).
- `DELETE /api/users/[id]` — deactivate first. Hard-delete replaces `user_id` in audit_events with a hash — don't lose the audit trail.

**UI** — `/settings/data-requests` for compliance_admin.

### Verification
- Export → ZIP contains all expected records.
- Deletion → status changes, 30-day timer visible, reverse works, hard-delete cascades correctly.
- Audit events referencing deleted user readable with hashed actor.

---

## Phase 9 — Voice & transcript retention controls

**Goal:** orgs can opt out of transcript retention; voice pipeline warns on over-capture.

### Scope

**Retention toggle** — `organizations.settings.retain_transcripts BOOLEAN DEFAULT true`. When false: Vapi webhook writes the structured note, then **deletes** rows from `voice_transcripts` and nulls `voice_sessions.full_transcript`. Raw note's `raw_input` keeps the transcript (source of truth per CLAUDE.md).

**Over-capture warning** — new Haiku prompt `src/lib/prompts/voice-sanity.ts` flags potential over-share patterns (financial details, unrelated personal commentary, references to other residents). Surfaces on the review screen as informational — does not block save.

**Note on Cekura timing** (see dedicated section below): if Cekura is adopted, the over-capture detector in this phase is redundant. Skip the voice-sanity prompt and use Cekura's evaluators instead. The retention toggle is still needed either way.

### Verification
- Toggle off → after a voice call, `voice_transcripts` rows gone.
- Call mentioning unrelated personal info → review screen shows over-capture warning.

### Not blocking prod PHI
Audio is already never persisted (`src/app/api/transcribe/route.ts:57`), so the voice layer already meets the spec's core requirement. This phase is about extending that posture to transcripts.

---

## Phase 10 — Compliance ops (non-code, ongoing)

**Not implementation — but cannot ship real PHI without this.**

- Sign BAAs with: Supabase, Anthropic, OpenAI, Vapi, Resend, Stripe, Vercel. (Plus Cekura if adopted.)
- Enable HIPAA-eligible tier on Supabase (dedicated instance or HIPAA add-on).
- Enable Vapi HIPAA add-on.
- Draft + publish content: Notice of Privacy Practices, Privacy Policy update, Terms update. Pages exist at `/privacy`, `/terms`, `/hipaa` — content update, not new routes.
- Incident response runbook (HIPAA requires breach notification within 60 days).
- Annual risk assessment document.
- Employee HIPAA training tracking: add `users.hipaa_training_completed_at`. Block access if > 12 months since training.
- **Engage qualified healthcare counsel** before turning on real PHI.

---

## Cekura AI — third-party integration timing

Cekura is an automated QA + observability platform for conversational AI agents. It integrates with Vapi (the voice provider CareNote already uses), detects hallucinations, runs simulated test conversations, and evaluates calls for compliance violations. Advertises HIPAA, SOC, GDPR.

### What it addresses

- **Vapi voice agent quality** — today testing is manual; Cekura runs thousands of simulated scenarios.
- **Hallucination detection** in the transcript → structured-note pipeline. Directly addresses CareNote's core safety promise ("never invent observations").
- **Over-capture detection** — replaces the Haiku voice-sanity prompt planned in Phase 9.
- **Production observability** — latency, sentiment, interruption, gibberish detection. CareNote has none today.
- **Compliance verification** — checks that the Vapi assistant doesn't diagnose, recommend treatment, or reference other residents on every call.

### What it doesn't address

- Nothing in Phases 2-5, 6-8 (data model, permissions, audit, consent, roles, session controls, data rights). Orthogonal.
- Text-only notes via `NoteInputForm` — those never touch Vapi.

### Recommendation

**Don't integrate before Phase 5.** Phases 2-5 close the blockers for real PHI; Cekura doesn't help with any of them. Integrating earlier spends vendor-integration time that doesn't buy compliance.

**Integrate during Phase 9 (or just before).** At that point:
1. You have voice call volume to justify the cost.
2. It cleanly replaces the Phase 9 voice-sanity prompt (save ~1 day of dev + the ongoing cost of maintaining that evaluator).
3. The rest of the compliance infrastructure is in place, so testing the voice layer becomes the remaining risk.

**When you do integrate:**
- Add Cekura to the Phase 10 BAA list.
- Configure Cekura webhook to ingest Vapi call events (both products already speak this API).
- Point Cekura's evaluation prompts at the structured-output shape from Phase 3.
- Add Cekura's real-time alerts to the ops notification path.
- Revisit Phase 9 plan — remove the voice-sanity prompt scope.

Rough integration effort: 1-2 days of wiring + ongoing prompt/eval tuning.

---

## Open decisions / things the owner should eventually weigh in on

These are flagged-but-not-blocked items. A future session can proceed without them, but they'll need an answer before production.

1. **Caregiver vs admin sharing.** Phase 1 restricts clinician sharing to admins. Decide in Phase 6 whether to extend to nurse_reviewer (probably yes) and/or caregiver (probably no — caregivers in a 6-20 bed home shouldn't own physician-facing disclosures).
2. **Structured output v1 → v2 migration cutover.** Phase 3 introduces the breaking shape change. Decide whether to backfill-reprocess existing notes (costs Claude credits) or leave them on v1 forever (timeline renderer has to keep both code paths).
3. **Magic link expiry default.** Phase 1 defaults to 14 days. Compliance counsel may want shorter (7 days) or org-configurable.
4. **Soft-delete retention window.** Phase 8 defaults to 30 days before hard-delete. Some state regs require longer (CA CMIA: 7 years for med records). Confirm before shipping deletion.
5. **Break-glass access** — for emergencies where a caregiver on a non-assigned resident has to document something urgent. Not in the roadmap. Decide whether to add to Phase 6.
6. **BAA with Cekura** if adopted in Phase 9. Would add one more vendor to the Phase 10 list.

## Pointers for any future Claude session picking this up

- The original Perplexity spec that drove this roadmap lives in your Messages attachments (you shared it once as `caregiver-app-update-spec.md`). If you need the full spec for edge cases, ask the user to re-share or point to where they saved it.
- The detailed Phase 1 implementation plan is at `/Users/pouyajavadi/.claude/plans/i-have-recently-talked-vast-clarke.md` (the user's personal plans folder, not in the repo).
- The CLAUDE.md at the repo root describes CareNote's architecture and conventions — read that first.
- Each phase's migration is one file, numbered sequentially. Starting point for Phase 2: `supabase/migrations/00006_family_authorizations.sql`.
