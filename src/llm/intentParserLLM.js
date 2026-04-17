import { parseIntent } from "../utils/parseIntent.js";
import { llmConfig } from "../config/llmConfig.js";
import { buildIntentPrompt } from "./intentPromptBuilder.js";
import { parseIntentResponse } from "./intentResponseParser.js";
import { validateIntentSpec } from "./intentSchemaValidator.js";

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function parseIntentWithMock(prompt) {
  return validateIntentSpec(parseIntent(prompt));
}

async function parseIntentWithYizhanProxy({ prompt, context, imageBase64, provider }) {
  const promptText = buildIntentPrompt({ prompt, context });
  const timeout = createAbortSignal(llmConfig.timeoutMs);

  try {
    const response = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        promptText,
        context,
        imageBase64: imageBase64 || null,
        provider,
      }),
      signal: timeout.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const rawText = String(payload?.raw_text || payload?.text || "");
    const parsed = parseIntentResponse(rawText);
    return validateIntentSpec(parsed);
  } finally {
    timeout.clear();
  }
}

export async function parseIntentWithLLM({
  prompt,
  context,
  imageBase64 = null,
  provider = llmConfig.provider,
}) {
  if (provider === "mock") {
    return parseIntentWithMock(prompt);
  }

  return parseIntentWithYizhanProxy({
    prompt,
    context,
    imageBase64,
    provider: "yizhan",
  });
}
