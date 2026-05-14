# Kinroster documentation

Docs are organised by audience. Most readers only need one or two of these directories.

| Directory | Audience | What's in it |
|---|---|---|
| [product/](./product/) | PMs, designers, anyone learning the product | What we're building and why — exec summary, PRD, user flows, feasibility notes. |
| [business/](./business/) | Founder, advisors, investors | Market, competition, GTM, business roadmap. |
| [engineering/](./engineering/) | Engineers (humans + AI agents) | Architecture, data model, prompts, build plan, integration notes. |
| [compliance/](./compliance/) | Legal / privacy / security / pilot ops | HIPAA + PDPA documents, disclosure templates, partner agreements, compliance trackers. |
| [marketing/](./marketing/) | Founder running launch outreach | Channel strategy, LinkedIn templates, network-email template. |
| [research/](./research/) | Founder validating product decisions | Customer / clinician / admin interview guides, pilot usage SQL. |

The root of the repo also has:
- [`README.md`](../README.md) — repo-level Next.js bootstrap notes.
- [`CLAUDE.md`](../CLAUDE.md) — instructions for AI agents working in this repo. Points back into this index.
- [`AGENTS.md`](../AGENTS.md) — Next.js-specific notes for AI agents (do not assume Next.js APIs from training data).
- [`prompts/`](../prompts/) — canonical LLM prompt specs (one `.md` per prompt + a CHANGELOG). Source of truth; runtime code in `src/lib/prompts/*.ts` mirrors these.

## Suggested reading order — new contributor onboarding

If you're new to Kinroster, read in this order:

1. [product/executive-summary.md](./product/executive-summary.md) — what is this thing
2. [product/product-requirements.md](./product/product-requirements.md) — what does it do (features F1-F10)
3. [product/user-flows.md](./product/user-flows.md) — how users actually interact with it
4. [engineering/architecture.md](./engineering/architecture.md) — how it's wired together
5. [engineering/data-model.md](./engineering/data-model.md) — the tables that matter
6. [engineering/entity-model-and-auth.md](./engineering/entity-model-and-auth.md) — roles, RLS, auth flow
7. [compliance/compliance-and-security.md](./compliance/compliance-and-security.md) — the rules every change must respect
8. [compliance/hipaa-roadmap.md](./compliance/hipaa-roadmap.md) — what's shipped, what's pending

After that, pick the section relevant to the work you're picking up.

## Full file list

### product/
- [executive-summary.md](./product/executive-summary.md)
- [product-requirements.md](./product/product-requirements.md) — PRD with features F1-F10
- [user-flows.md](./product/user-flows.md)
- [agent-capabilities-feasibility.md](./product/agent-capabilities-feasibility.md) — feasibility analysis for proposed AI agent capabilities

### business/
- [market-analysis.md](./business/market-analysis.md)
- [go-to-market.md](./business/go-to-market.md)
- [business-roadmap.md](./business/business-roadmap.md)
- [competitive-intelligence.md](./business/competitive-intelligence.md)

### engineering/
- [architecture.md](./engineering/architecture.md) — technical architecture
- [data-model.md](./engineering/data-model.md)
- [entity-model-and-auth.md](./engineering/entity-model-and-auth.md)
- [prompt-engineering.md](./engineering/prompt-engineering.md)
- [build-plan.md](./engineering/build-plan.md)
- [vapi-voice-integration.md](./engineering/vapi-voice-integration.md)
- [pre-pilot-correctness-fixes.md](./engineering/pre-pilot-correctness-fixes.md)

### compliance/
- [compliance-and-security.md](./compliance/compliance-and-security.md) — master compliance overview
- [hipaa-roadmap.md](./compliance/hipaa-roadmap.md) — 10-phase plan toward full HIPAA readiness
- [data-handling-disclosure.md](./compliance/data-handling-disclosure.md) — for facility partners
- [compliance-action-tracker.md](./compliance/compliance-action-tracker.md)
- [compliance-gaps.md](./compliance/compliance-gaps.md)
- [public-launch-security-progress.md](./compliance/public-launch-security-progress.md)
- [pilot-partner-agreement.md](./compliance/pilot-partner-agreement.md) — design-partner informed consent
- [resident-notification-template.md](./compliance/resident-notification-template.md) — template for facilities to distribute

### marketing/
- [launch-strategy-2026-05.md](./marketing/launch-strategy-2026-05.md) — channel strategy + Day-1 checklist
- [linkedin-foundational-post.md](./marketing/linkedin-foundational-post.md)
- [linkedin-cold-outreach.md](./marketing/linkedin-cold-outreach.md)
- [email-network-ask.md](./marketing/email-network-ask.md)

### research/
- [clinician-interviews-2026-05.md](./research/clinician-interviews-2026-05.md) — interview guide + decision section
- [admin-interviews-2026-05.md](./research/admin-interviews-2026-05.md)
- [clinician-share-metrics.sql](./research/clinician-share-metrics.sql) — reusable pilot-usage queries
- [customer-interviews.md](./research/customer-interviews.md) — earlier customer-interview notes

## Conventions

- **Filenames:** `lowercase-hyphenated.md`. No numeric prefixes — reading order is documented in this README rather than encoded in filenames (categorisation matters more than sequence).
- **Date-stamped docs:** when a doc represents a snapshot in time (interviews, launch plans), use a `-YYYY-MM` suffix (e.g., `launch-strategy-2026-05.md`). Evergreen docs do not have a date.
- **One doc, one purpose.** Don't merge unrelated topics into one file just because they're short — they're easier to find when separate.
- **New docs go in an existing folder if possible.** Add a new top-level folder under `docs/` only when the new category clearly doesn't fit any existing one. When you do add one, also add it to the table at the top of this file.
