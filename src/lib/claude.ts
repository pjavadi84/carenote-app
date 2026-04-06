import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 10000;

interface ClaudeCallOptions {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export async function callClaude({
  model = "claude-sonnet-4-6-20250514",
  systemPrompt,
  userPrompt,
  maxTokens = 1024,
}: ClaudeCallOptions): Promise<string> {
  const makeCall = () =>
    anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await makeCall();
    clearTimeout(timeout);

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    return textBlock.text;
  } catch (error: unknown) {
    // Retry once on 5xx or timeout
    const isRetryable =
      error instanceof Anthropic.APIError
        ? error.status >= 500
        : error instanceof Error && error.name === "AbortError";

    if (isRetryable) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

      const response = await makeCall();
      const textBlock = response.content.find(
        (block) => block.type === "text"
      );
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from Claude on retry");
      }
      return textBlock.text;
    }

    throw error;
  }
}

export function parseJsonResponse<T>(raw: string): T {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
  return JSON.parse(cleaned) as T;
}
