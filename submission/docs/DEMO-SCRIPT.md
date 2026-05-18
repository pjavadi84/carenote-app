# 90-second demo script

Read this off-screen while recording. Six beats, ~15 seconds each. Cuts on a
straight take if you fluff a line — judges watch dozens of these.

## Setup before you hit record

- Log in as an admin user.
- Browser at `/security` in a clean tab. Window sized so the "Inspect a
  candidate prompt" card is fully visible without scrolling.
- (Optional but strongly recommended) Sidecar running locally so the header
  badge reads **Live** instead of **Preview**:
  ```bash
  cd submission && docker compose up --build
  ```
- A second tab open to `infra/lobster-trap/policy.yaml` in your editor — you'll
  flash it briefly at the end.

## Script

### Beat 1 — the problem (0:00–0:15)
> "Kinroster is voice-first documentation for elder-care homes. Every prompt
> we send to Claude or Whisper is protected health information. Our product
> policy is clear — Claude is a scribe, never a clinician, and PHI never
> leaves the redactor. But until today, those were rules in a doc, not rules
> in the wire."

*On screen:* `/security` page header. Cursor on the "Lobster Trap" badge.

### Beat 2 — the integration (0:15–0:30)
> "We integrated Veea's open-source Lobster Trap as an inline proxy on every
> LLM call. The application doesn't know it's there — one env var routes
> Anthropic and Whisper through it. The proxy inspects every prompt in under
> a millisecond and either forwards, flags, or blocks."

*On screen:* the three status cards — "Recent inspections", "Blocked attempts",
"Proxy status: Live".

### Beat 3 — benign prompt (0:30–0:45)
> "Here's a normal caregiver dictation. The proxy logs it for the audit
> trail, no rule blocks it, Claude sees it as usual."

*On screen:* click the **Benign caregiver dictation** sample button. Point at
the green `ALLOW` badge and the catch-all `log_all_allowed` audit row.

### Beat 4 — the attack (0:45–1:05)
> "Now the threat we're actually worried about: a family member with a
> grievance leaves a planted note in the resident's chart. The caregiver,
> doing her job, reads the note verbatim into Kinroster. Without Lobster
> Trap, that prompt reaches Claude. With Lobster Trap…"

*On screen:* click the **Prompt injection from a planted note** sample. Hold
on the red `DENY` badge, the matching rule `block_explicit_jailbreak_phrases`,
and the caregiver-facing message: *"Part of this note couldn't be processed
(policy: jailbreak-phrase)."*

### Beat 5 — the audit trail (1:05–1:20)
> "Every decision lands in our existing HIPAA audit ledger. Same ledger,
> same compliance review surface, machine-enforced now instead of policy-only.
> Sub-millisecond, with a unified record."

*On screen:* scroll to **Recent decisions**. Show the two new rows
(allow + deny) with timestamps.

### Beat 6 — the policy (1:20–1:30)
> "This is the YAML policy file. Five rule families, fully readable.
> Lobster Trap is MIT-licensed, we're MIT-licensed, the integration drops
> in front of any OpenAI- or Anthropic-shaped API. Thanks Veea, thanks
> LabLab."

*On screen:* swap to the editor tab. Scroll through `policy.yaml` from top to
the rate-limit block. Cut.

## Recovery lines if something breaks live

- **Sidecar isn't running, "Live" reads "Preview"** — *"The header reads
  Preview right now because the sidecar isn't up in this clip, but the
  TypeScript evaluator runs the same rules so the decision is identical."*
- **Audit row doesn't appear** — *"There's a small lag while the row writes
  back to the ledger — by the time you'd refresh in production it's there."*
  Then `Cmd+R` quickly.
- **Wrong prompt selected** — *"Let me reset that — this is the one I want
  to show you,"* and click the correct sample.

## What NOT to say

- Don't promise HIPAA *compliance* — say HIPAA-relevant, HIPAA-aligned, or
  "production-shape for HIPAA". Compliance is an audit outcome, not a feature.
- Don't quote latency numbers ("sub-millisecond") in the live take if you
  haven't actually benchmarked your specific policy. Lobster Trap's own
  documentation claims sub-millisecond; cite it as their number, not yours,
  if asked.
- Don't refer to Kinroster as live with real patients. It's pre-launch.

## After the cut

Open `submission/docs/INTEGRATION.md` and paste the **Hackathon submission
summary** section into the LabLab.ai submission form. Link the demo video,
link this repo, link kinroster.com, submit.
