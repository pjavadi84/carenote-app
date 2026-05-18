// Policy evaluator that mirrors infra/lobster-trap/policy.yaml.
//
// The canonical enforcement happens in the Lobster Trap proxy
// (a Go binary that sits inline between Kinroster and the LLM
// providers — see infra/lobster-trap/README.md). This TypeScript
// implementation is used by the /security admin page so judges, ops,
// and compliance reviewers can preview what *would* happen to a given
// prompt without spinning up the sidecar or burning an LLM call.
//
// Keep the rule definitions in sync with policy.yaml. The two are
// hand-mirrored on purpose: the YAML is the source of truth at
// runtime, this file is the source of truth in the UI.

export type LobsterTrapAction = "ALLOW" | "DENY" | "LOG";

export interface LobsterTrapRule {
  name: string;
  priority: number;
  action: LobsterTrapAction;
  pattern: RegExp;
  description: string;
  denyMessage?: string;
}

export interface LobsterTrapMatch {
  rule: LobsterTrapRule;
  excerpt: string;
}

export interface LobsterTrapDecision {
  finalAction: LobsterTrapAction;
  matches: LobsterTrapMatch[];
  blockingRule?: LobsterTrapRule;
}

// Order doesn't matter for evaluation; we sort by priority before
// picking the final action. Higher priority = evaluated first.
export const RULES: LobsterTrapRule[] = [
  {
    name: "block_prompt_injection_builtin",
    priority: 100,
    action: "DENY",
    pattern:
      /\b(jailbreak|DAN mode|developer mode|do anything now|simulate (an?|the) (uncensored|unfiltered))\b/i,
    description:
      "Catches common jailbreak vocabulary. The upstream proxy adds Lobster Trap's full built-in injection detector on top of this.",
    denyMessage:
      "[Kinroster] Part of this note couldn't be processed (policy: prompt-injection).",
  },
  {
    name: "block_explicit_jailbreak_phrases",
    priority: 99,
    action: "DENY",
    pattern:
      /(ignore (all |any |previous |prior )?(instructions|prompts|rules)|disregard (the |your )?(system|previous)|from now on,? (you|the assistant))/i,
    description:
      "Explicit jailbreak phrasings caregivers might be tricked into dictating from a planted note or hostile family letter.",
    denyMessage:
      "[Kinroster] Part of this note couldn't be processed (policy: jailbreak-phrase).",
  },
  {
    name: "block_ssn_pattern",
    priority: 90,
    action: "DENY",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
    description:
      "SSN shape. The server-side redactor should catch this first; this is defence-in-depth at the LLM boundary.",
    denyMessage:
      "[Kinroster] Detected a sensitive identifier (SSN-shaped). Note not processed.",
  },
  {
    name: "block_credit_card_pattern",
    priority: 89,
    action: "DENY",
    pattern: /\b(?:\d[ -]*?){13,16}\b/,
    description: "Credit-card-shaped digit sequences.",
    denyMessage:
      "[Kinroster] Detected payment-card-shaped data. Note not processed.",
  },
  {
    name: "block_credential_leak",
    priority: 80,
    action: "DENY",
    pattern:
      /\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|Bearer [A-Za-z0-9._-]{20,})\b/,
    description:
      "API-key, GitHub PAT, AWS access key, and bearer-token shapes that should never end up in an LLM prompt.",
    denyMessage:
      "[Kinroster] Detected a credential-shaped value. Note not processed.",
  },
  {
    name: "flag_clinical_advice_request",
    priority: 50,
    action: "LOG",
    pattern:
      /\b(diagnose|diagnosis of|should (we|i) prescribe|recommended? treatment|what medication|is this (a )?(stroke|heart attack|infection))\b/i,
    description:
      "Kinroster's rule is 'Claude is a scribe, never a clinician'. We log (don't block) requests that try to elicit clinical advice so compliance can review frequency.",
  },
  {
    name: "log_all_allowed",
    priority: 1,
    action: "LOG",
    pattern: /[\s\S]+/,
    description:
      "Catch-all: every prompt produces an audit row regardless of outcome.",
  },
];

const PRIORITY_DESC = [...RULES].sort((a, b) => b.priority - a.priority);

// 80-char preview centred on the first match, with ellipsis on either
// side. Used for the audit row and the /security UI.
function excerpt(prompt: string, match: RegExpExecArray): string {
  const start = Math.max(0, match.index - 30);
  const end = Math.min(prompt.length, match.index + match[0].length + 30);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < prompt.length ? "…" : "";
  return `${prefix}${prompt.slice(start, end)}${suffix}`;
}

/**
 * Evaluate a prompt against every rule and return the final action.
 *
 * Semantics mirror Lobster Trap's policy engine:
 * - Each rule is evaluated independently.
 * - The highest-priority matching rule that has action DENY wins.
 * - If no DENY matches, the action is ALLOW with all matching LOG rules
 *   surfaced.
 * - The catch-all LOG rule at priority 1 always fires, so every prompt
 *   produces an audit trail.
 */
export function evaluatePrompt(prompt: string): LobsterTrapDecision {
  const matches: LobsterTrapMatch[] = [];

  for (const rule of PRIORITY_DESC) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    const m = re.exec(prompt);
    if (m) {
      matches.push({ rule, excerpt: excerpt(prompt, m) });
    }
  }

  const blockingRule = matches.find((m) => m.rule.action === "DENY")?.rule;
  const finalAction: LobsterTrapAction = blockingRule ? "DENY" : "ALLOW";

  return { finalAction, matches, blockingRule };
}
