# Kinroster

**AI-native documentation for small residential care facilities.**

Kinroster takes the 15-minute end-of-shift paperwork tax off caregivers in small (6–20 bed) elder-care facilities. A caregiver speaks a 90-second shift summary; AI turns it into an audit-ready, structured care note. Families get opt-in updates; doctors get a secure summary before a visit. Compliance posture (HIPAA in the US, 個人資料保護法 / 長期照顧服務法 in Taiwan) is built in from day one.

The product runs in **two regions**: the US (kinroster.com, West-US Supabase, HIPAA posture) and Taiwan (kinroster-tw deployment, Tokyo Supabase, PDPA posture). The same codebase serves both; region-specific behaviour is gated by `organizations.regulatory_region` (`hipaa_us` or `pdpa_tw`).

> Stage as of 2026-05-14: end-to-end product working in production; pre-pilot; validation interviews and marketing outreach in flight. See [`docs/marketing/launch-strategy-2026-05.md`](./docs/marketing/launch-strategy-2026-05.md) and [`docs/research/clinician-interviews-2026-05.md`](./docs/research/clinician-interviews-2026-05.md).

---

## Table of contents

- [What it does, in one minute](#what-it-does-in-one-minute)
- [Tech stack](#tech-stack)
- [Architecture at a glance](#architecture-at-a-glance)
- [Local development](#local-development)
- [Repository layout](#repository-layout)
- [Key concepts every contributor needs to know](#key-concepts-every-contributor-needs-to-know)
- [Common commands](#common-commands)
- [Deployment & environments](#deployment--environments)
- [Compliance non-negotiables](#compliance-non-negotiables)
- [Contributing](#contributing)
- [Where to find more](#where-to-find-more)

---

## What it does, in one minute

The product has three feature loops that build on each other:

### 1. Caregiver → structured shift note (the daily driver)
- Caregiver opens a resident's page, presses **Voice Call**
- Vapi initiates a voice conversation; the AI assistant guides a 90-second shift summary
- OpenAI Whisper transcribes the audio (never stored)
- The transcript is shipped to Claude Sonnet 4.6 with the resident's locale + grounding context
- Claude returns a structured JSON output (mood, meals, meds, mobility, safety events, follow-up, sensitivity flags)
- Note row is created with `raw_input` (transcript) and `structured_output` (Claude JSON); admin sees both

### 2. Facility → family member (opt-in)
- Admin reviews structured notes for a resident, drafts a family update
- Recipient confirms their email via a one-time link before any PHI is sent (added 2026-05-14 after a real misdirected-PHI incident)
- Resend sends the email; `family_communications` and `disclosure_events` rows are written for audit

### 3. Facility → healthcare provider (magic link)
- Admin selects a resident's clinician + a date range
- Claude generates a clinician-focused summary (different prompt; clinically oriented sections + safety events)
- A one-time magic link is emailed to the clinician; portal at `/portal/clinician/[token]` shows the summary
- Token, opens, and revocations are logged in `clinician_share_links`

A background Inngest job retries any structurings that fail mid-flight, with exponential back-off and a hard cap before giving up.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript, React 19 |
| UI | Tailwind CSS, shadcn/ui, lucide-react icons, sonner (toasts) |
| Backend | Next.js Route Handlers (Node runtime), Vercel Fluid Compute |
| Database | Supabase (Postgres + Auth + RLS); two prod projects (US Oregon, TW Tokyo) |
| LLMs | Claude Sonnet 4.6 (structuring + summarisation), Claude Haiku 4.5 (classification + voice sanity) |
| Voice | Vapi (intake calls), OpenAI Whisper (transcription) |
| Email | Resend (kinroster.com domain verified) |
| Billing | Stripe |
| Background jobs | Inngest |
| Hosting | Vercel (two projects: `carenote-app` US, `kinroster-tw` Taiwan) |
| Package manager | pnpm |
| Testing | Vitest (unit), Playwright (e2e) |

---

## Architecture at a glance

```
                        ┌──────────────────────────┐
                        │  Caregiver (browser)     │
                        │  presses "Voice Call"    │
                        └────────────┬─────────────┘
                                     │
                  /api/voice/start   ▼
                        ┌──────────────────────────┐
                        │   Vapi voice session     │ ◄─── AI assistant
                        │   (web call, web audio)  │      (multilingual,
                        └────────────┬─────────────┘      culturally aware)
                                     │
                  end-of-call webhook▼
                        ┌──────────────────────────┐
                        │  /api/voice/webhook      │
                        │  1. Whisper transcribes  │
                        │  2. notes row created    │
                        │  3. Claude Sonnet structures
                        │  4. voice-sanity in parallel
                        └────────────┬─────────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │  Supabase Postgres + RLS │
                        │  org-scoped, audit-logged│
                        └────┬────────────────┬────┘
                             │                │
            family update    │                │   clinician share
                             ▼                ▼
            ┌────────────────────┐   ┌──────────────────────────┐
            │ /api/family/send   │   │  /api/share/clinician    │
            │  → Resend          │   │  → magic-link token      │
            │  (gated on email   │   │  → Resend (link only)    │
            │  confirmation)     │   │                          │
            └─────────┬──────────┘   └────────────┬─────────────┘
                      │                            │
                      ▼                            ▼
              family inbox                 /portal/clinician/[token]
                                           (unauthenticated, rate-limited)
```

Cross-cutting:

- **Auth**: Supabase Auth (email/password today; phone OTP planned for Taiwan).
- **Authorization**: every table has RLS keyed on `organization_id`; role-based predicates layered on top.
- **Audit**: every PHI-touching action writes to `audit_events`; every external disclosure writes to `disclosure_events`.
- **Background work**: Inngest retries failed structurings; cron jobs for weekly summaries.

For details: [docs/engineering/architecture.md](./docs/engineering/architecture.md) and [docs/engineering/data-model.md](./docs/engineering/data-model.md).

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker Desktop (for local Supabase)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Vercel CLI (`pnpm i -g vercel`)
- API keys for: Anthropic, OpenAI, Resend, Vapi, Stripe (test mode is fine)

### First-time setup

```bash
git clone <this-repo>
cd "Kinroster - aka Carenote"
pnpm install

# Start local Supabase (Docker)
supabase start

# Apply migrations + seed test data
pnpm db:migrate
pnpm db:seed

# Generate typed database client from local schema
pnpm db:types
```

### Configure environment

Copy `.env.local.example` to `.env.local` and fill in the keys. The local Supabase URL/anon key are printed by `supabase start`.

### Run the app

```bash
# Terminal 1 — Next.js dev server
pnpm dev                      # http://localhost:3000

# Terminal 2 — Inngest dev server (for background jobs)
pnpm dev:worker               # http://localhost:8288
```

### Test accounts (local seed)

- `admin@local.dev` / `password123`
- `owner@local.dev` / `password123`
- `caregiver@local.dev` / `password123`

### Local URLs

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://localhost:54323 |
| Inngest dev | http://localhost:8288 |

---

## Repository layout

```
.
├── README.md                   ← you are here
├── CLAUDE.md                   ← instructions for AI agents working in this repo
├── AGENTS.md                   ← Next.js-specific notes for AI agents
│
├── docs/                       ← all narrative documentation
│   ├── README.md               ← index, by audience
│   ├── product/                ← what we're building and why
│   ├── business/               ← market, GTM, competition
│   ├── engineering/            ← architecture, data model, prompts
│   ├── compliance/             ← HIPAA, PDPA, legal templates
│   ├── marketing/              ← launch playbook
│   └── research/               ← interviews + pilot SQL
│
├── prompts/                    ← canonical LLM prompt specs (source of truth)
│   ├── README.md
│   ├── CHANGELOG.md
│   ├── shift-note-structuring.md
│   ├── clinician-summary.md
│   ├── family-update.md
│   ├── vapi-intake-assistant.md
│   ├── incident-classify.md
│   ├── incident-report.md
│   ├── voice-sanity.md
│   └── weekly-summary.md
│
├── src/
│   ├── app/                    ← Next.js App Router
│   │   ├── (auth)/             ← signup, login
│   │   ├── (dashboard)/        ← admin + caregiver UI
│   │   ├── (public)/           ← landing, privacy, family confirmation
│   │   ├── portal/clinician/[token]/  ← unauthenticated clinician magic-link portal
│   │   └── api/                ← Route Handlers (server functions)
│   ├── components/             ← shared UI (shadcn-derived)
│   ├── lib/                    ← server-side utils
│   │   ├── supabase/           ← server, admin, client factories
│   │   ├── prompts/            ← runtime prompt builders (mirror prompts/)
│   │   ├── services/           ← structureNote() and friends
│   │   ├── pdpa/               ← Taiwan-specific consent helpers
│   │   ├── i18n/               ← locale + cultural-register helpers
│   │   └── resend.ts           ← email templates
│   ├── types/database.ts       ← generated Supabase types
│   └── test/fixtures.ts        ← shared test fixtures
│
├── supabase/
│   ├── migrations/             ← 26 SQL migrations (in order)
│   ├── seeds/                  ← local seed data
│   └── config.toml             ← local Supabase config
│
└── .claude/                    ← Claude Code config
    ├── settings.json           ← project-level (committed)
    ├── settings.local.json     ← personal overrides (gitignored)
    └── hooks/                  ← migration-drift + pre-PR check scripts
```

---

## Key concepts every contributor needs to know

### Data is org-scoped via RLS

Every table that holds tenant data has an `organization_id` column and an RLS policy keyed on `get_user_org_id()`. **Never query a tenant table without that column being respected.** Use `createServerSupabaseClient()` from `src/lib/supabase/server.ts` — it carries the user's session and RLS works automatically. `createAdminClient()` (service role) bypasses RLS — only use it for unauthenticated endpoints (e.g., the clinician portal) or background jobs, and always scope the query manually.

### Voice audio is never stored

Whisper transcribes; the audio file is discarded immediately. Only the transcript text lives in `notes.raw_input` and (after retention rules) `voice_sessions.full_transcript`. Don't add logging that captures audio.

### Notes have two outputs

- `raw_input` — the literal transcript or typed text. **Source of truth.** Never overwrite.
- `structured_output` — Claude-generated JSON (sections, summary, flags). Regenerable via `structureNote()`.
- `edited_output` — admin-supplied edits to the structured output. Takes precedence when present.

The `is_structured` boolean flags whether structuring succeeded. The `structuring_attempts` + `structuring_giving_up` columns drive Inngest's retry loop.

### Two roles + compliance role

- `caregiver` — can create notes for residents in their org; limited read.
- `admin` — full org access; sends family updates and clinician shares.
- `compliance_admin` — special role for audit-only access; can revoke disclosures.

Role checks live in route handlers (server-side); RLS predicates use `is_admin()` and `is_compliance_admin()` helpers.

### Region is decided per-organisation

`organizations.regulatory_region` is `hipaa_us` or `pdpa_tw`. Set from signup metadata (`NEXT_PUBLIC_REGULATORY_REGION` on the Vercel project) via the `handle_new_user` trigger. Region drives: PDPA consent gates (`pdpa_consent_required` check), disclosure-footer locale, mandatory-reporting timelines.

### Prompts are versioned

Every LLM prompt has a canonical spec in `prompts/<name>.md` with YAML frontmatter (id, version, prior_version, runtime, model, languages, variables). Runtime code in `src/lib/prompts/*.ts` references the spec. The Vapi assistant is paste-synced from `prompts/vapi-intake-assistant.md`. See [`prompts/README.md`](./prompts/README.md) and [`prompts/CHANGELOG.md`](./prompts/CHANGELOG.md).

### PHI and AI traffic boundary

The `redactPhiText()` helper in `src/lib/redaction.ts` strips Taiwan ROC ID, Vietnamese CCCD, Indonesian NIK, full DOBs, US street addresses, and SSNs. Wrap any string that goes to a third-party LLM with it BEFORE the API call. Anthropic and OpenAI BAAs exist for US HIPAA; Taiwan BAAs/DPAs are still being negotiated for Vapi / ElevenLabs / Deepgram.

---

## Common commands

```bash
# Dev
pnpm dev                       # Next.js dev server
pnpm dev:worker                # Inngest dev server (background jobs)
pnpm build                     # production build

# Quality
pnpm lint                      # ESLint
pnpm exec tsc --noEmit         # TypeScript check
pnpm exec vitest run           # unit tests once
pnpm exec vitest               # unit tests in watch mode

# Tests for changed files only (matches pre-push hook)
pnpm exec vitest run --changed origin/main

# Database (local)
pnpm db:migrate                # apply all migrations to local Supabase
pnpm db:seed                   # seed test data
pnpm db:reset                  # migrate + seed (destructive on local)
pnpm db:types                  # regenerate src/types/database.ts from local schema

# Database (production)
supabase link --project-ref dqjxlovjehhdoehiehyo   # US prod
supabase link --project-ref qwcjrdiifkklwhazjmgx   # Taiwan prod
supabase migration list --linked
supabase db push --linked --dry-run                # always dry-run first
supabase db push --linked
```

---

## Deployment & environments

| Env | URL | Vercel project | Supabase project | Branch |
|---|---|---|---|---|
| US production | https://kinroster.com | `carenote-app` | `dqjxlovjehhdoehiehyo` (Oregon) | `main` |
| Taiwan production | https://kinroster-tw-...vercel.app (no custom domain yet) | `kinroster-tw` | `qwcjrdiifkklwhazjmgx` (Tokyo) | `main` (different env vars) |
| Preview | per-PR URLs auto-deployed by Vercel | both | local seed | feature branch |

Region is determined by **Vercel env vars** per project, not by branch. Both projects deploy from `main` but with different `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_REGULATORY_REGION` values.

### Applying a migration to production

1. Take a backup snapshot via Supabase dashboard (Database → Backups → "Create backup").
2. `supabase link --project-ref <ref>` for the target project.
3. `supabase db push --linked --dry-run` to see what would apply.
4. `supabase db push --linked` to apply.
5. Verify with `supabase migration list --linked`.
6. Repeat for the second prod project.

A SessionStart Claude Code hook (`.claude/hooks/check-migration-drift.sh`) warns you on session open if either prod is behind on migrations.

---

## Compliance non-negotiables

These rules predate every PR; do not break them.

- **PHI never gets logged.** No `console.log(note)`, no telemetry containing `raw_input` or `structured_output`. The redaction helper in `src/lib/redaction.ts` is the LLM boundary; logging boundaries get a different treatment (redact or drop entirely).
- **RLS enabled before any policy.** New tables: `ALTER TABLE foo ENABLE ROW LEVEL SECURITY;` BEFORE `CREATE POLICY`. Migrations that miss this leak by default.
- **Functions set `search_path`.** `SET search_path = ''` on every function to prevent injection via schema confusion.
- **Authenticated Supabase client in routes.** `createServerSupabaseClient()` from `src/lib/supabase/server.ts` — never `createClient()` in API routes.
- **Claude is a scribe, not a clinician.** Prompts and outputs must never diagnose, recommend treatment, or speculate clinically.
- **Caregiver observations are sacred.** Preserve the caregiver's factual statements exactly. Structuring can reorganise; it must not invent, soften, or fabricate.

Detailed compliance posture: [docs/compliance/compliance-and-security.md](./docs/compliance/compliance-and-security.md).
HIPAA phased rollout: [docs/compliance/hipaa-roadmap.md](./docs/compliance/hipaa-roadmap.md).

---

## Contributing

### Branch naming
- `feature/<short-name>` — new functionality
- `fix/<short-name>` — bug fixes
- `docs/<short-name>` — docs-only changes
- `research/<short-name>` — non-code research artifacts

### Pull request rules

1. **Every PR body MUST lead with a TLDR in plain, non-technical language.** The TLDR is for non-engineers (founders, designers, contributors who skim) — say what changes for a user/operator and why, no file paths, no function names. After the TLDR, use the standard `## Summary` (technical details, file paths) and `## Test plan` sections.
2. **CI must pass.** Type-check + lint + Vitest unit tests run on PR open. A PreToolUse hook in `.claude/settings.json` runs the same checks locally before `gh pr create`.
3. **Don't bypass security gates.** No `--no-verify` on git, no `--force` to main, no `git push --force` to a shared branch.
4. **Migrations are append-only.** New migrations get the next sequential number; never edit an applied migration. Always include a comment header explaining the change's motivation.

### Code patterns

- **Database queries**: import from typed helpers (`src/lib/queries/*` where they exist).
- **Validation**: Zod schemas in `src/lib/validators/`.
- **UI**: shadcn/ui components only; never native HTML form elements. Semantic Tailwind colours (`text-foreground`, `bg-background`) — never hardcoded greys.
- **Icons**: `lucide-react`. No emoji in the UI.
- **State**: server components by default; client components only when needed (forms, interactivity).

For LLM model selection guidance, locale handling, and the rest of the patterns: [docs/engineering/prompt-engineering.md](./docs/engineering/prompt-engineering.md).

---

## Where to find more

| You want to... | Read |
|---|---|
| Understand the product end-to-end | [`docs/product/executive-summary.md`](./docs/product/executive-summary.md) |
| See the feature list (F1–F10) | [`docs/product/product-requirements.md`](./docs/product/product-requirements.md) |
| Wire up a new API route | [`docs/engineering/architecture.md`](./docs/engineering/architecture.md) + [`docs/engineering/entity-model-and-auth.md`](./docs/engineering/entity-model-and-auth.md) |
| Add or modify a prompt | [`prompts/README.md`](./prompts/README.md) + [`prompts/CHANGELOG.md`](./prompts/CHANGELOG.md) |
| Add or modify a database table | [`docs/engineering/data-model.md`](./docs/engineering/data-model.md) + read recent migrations under `supabase/migrations/` |
| Understand the compliance constraints | [`docs/compliance/compliance-and-security.md`](./docs/compliance/compliance-and-security.md) |
| Know what's coming next | [`docs/compliance/hipaa-roadmap.md`](./docs/compliance/hipaa-roadmap.md) + [`docs/engineering/build-plan.md`](./docs/engineering/build-plan.md) |
| See current go-to-market | [`docs/business/go-to-market.md`](./docs/business/go-to-market.md) + [`docs/marketing/launch-strategy-2026-05.md`](./docs/marketing/launch-strategy-2026-05.md) |
| Validate a product decision | [`docs/research/`](./docs/research/) |
| Index of everything | [`docs/README.md`](./docs/README.md) |

If you're brand-new to the project, read the [suggested onboarding order in docs/README.md](./docs/README.md#suggested-reading-order--new-contributor-onboarding) — it walks you from product overview through architecture and compliance in 8 docs.

---

## Maintainer

Pouya Javadi · solo founder. Open to pilot partners (6–20 bed RCFEs, US or Taiwan). See [`docs/marketing/launch-strategy-2026-05.md`](./docs/marketing/launch-strategy-2026-05.md) for current outreach.
