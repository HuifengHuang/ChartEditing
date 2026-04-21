import { llmConfig } from "../config/llmConfig.js";
import { buildExtractionPrompt } from "./extractionPromptBuilder.js";
import { parseExtractionResponse } from "./extractionResponseParser.js";
import { validateExtractionLLMResult } from "./extractionSchemaValidator.js";

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

export async function runExtractionLLM({ intent, parts }) {
  const promptText = buildExtractionPrompt({
    intent,
    sourceData: parts?.source_data || {},
    renderCode: parts?.render_code || "",
  });
  console.log("[Extraction] Prompt Input:", promptText);

  const timeout = createAbortSignal(llmConfig.timeoutMs);
  try {
    const response = await fetch(llmConfig.extractionEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        promptText,
        intent,
        sourceData: parts?.source_data || {},
        renderCode: parts?.render_code || "",
        provider: "yizhan",
      }),
      signal: timeout.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const rawText = String(payload?.raw_text || payload?.text || "").trim();
    if (!rawText) {
      throw new Error("Extraction LLM response is empty.");
    }
    console.log("[Extraction] Model Output:", rawText);

    const parsed = parseExtractionResponse(rawText);
    return validateExtractionLLMResult(parsed, parts);
  } finally {
    timeout.clear();
  }
}
