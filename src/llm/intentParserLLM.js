import { llmConfig } from "../config/llmConfig.js";
import { buildIntentPrompt } from "./intentPromptBuilder.js";
import { parseIntentResponse } from "./intentResponseParser.js";
import { validateIntentList } from "./intentSchemaValidator.js";

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function parseIntentWithYizhanProxy({ prompt, context, imageBase64 }) {
  const promptText = buildIntentPrompt({ prompt, context });
  const normalizedImageBase64 =
    typeof imageBase64 === "string" && imageBase64.trim() ? imageBase64.trim() : null;
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
        imageBase64: normalizedImageBase64,
        provider: "yizhan",
      }),
      signal: timeout.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const rawText = String(payload?.raw_text || payload?.text || "");
    if (!rawText.trim()) {
      throw new Error("LLM response is empty.");
    }
    const parsed = parseIntentResponse(rawText);
    return validateIntentList(parsed);
  } finally {
    timeout.clear();
  }
}

export async function parseIntentWithLLM({
  prompt,
  context,
  imageBase64 = null,
}) {
  return parseIntentWithYizhanProxy({
    prompt,
    context,
    imageBase64,
  });
}
