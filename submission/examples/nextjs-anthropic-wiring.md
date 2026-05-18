# Wiring a Next.js app through Lobster Trap

The proxy is OpenAI-shape and Anthropic-shape transparent — it inspects the
request body and forwards on. From the application side, the change is a single
optional env var per upstream.

## Anthropic SDK

```ts
// src/lib/claude.ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  ...(process.env.ANTHROPIC_BASE_URL
    ? { baseURL: process.env.ANTHROPIC_BASE_URL }
    : {}),
});
```

When `ANTHROPIC_BASE_URL=http://localhost:8080` is set, every `anthropic.messages.create(...)`
call routes through Lobster Trap first. When unset, the SDK behaves identically to
before — no proxy, direct to `api.anthropic.com`.

## OpenAI Whisper (raw fetch)

```ts
// src/app/api/transcribe/route.ts
const whisperBase = process.env.WHISPER_BASE_URL ?? "https://api.openai.com";

const response = await fetch(`${whisperBase}/v1/audio/transcriptions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: whisperFormData,
});
```

Same pattern: `WHISPER_BASE_URL=http://localhost:8081` routes through the second
sidecar; unset = direct to OpenAI.

## Why this shape

- **Reversible.** Removing the env var instantly reverts to direct-to-LLM. No
  feature flag, no deploy, no code change required to roll back.
- **No new SDK surface.** Existing call sites — `callClaude(...)`,
  `fetch("…/audio/transcriptions")` — are unchanged. Only the transport URL moves.
- **Audit ledger reuse.** The proxy's JSON audit stream feeds into the
  application's existing audit ledger via a small tail job; we don't need a
  parallel "security log" UI.

## Local dev loop

```bash
# Terminal 1: bring up the proxies
cd submission
docker compose up --build

# Terminal 2: set the env and run your app
export ANTHROPIC_BASE_URL=http://localhost:8080
export WHISPER_BASE_URL=http://localhost:8081
pnpm dev
```

Hit any code path that calls Claude or Whisper; Lobster Trap's stdout shows
the decision (allow/deny/log) and the matching rule.
