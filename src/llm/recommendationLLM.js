import { llmConfig } from "../config/llmConfig.js";
import { buildRecommendationPrompt } from "./recommendationPromptBuilder.js";
import { parseRecommendationResponse } from "./recommendationResponseParser.js";

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// 调用推荐模型：输入 recommendationTemplate + 图片 + 意图分解 JSON。
export async function parseRecommendationWithLLM({
  intentDecomposeJson,
  imageBase64 = null,
}) {
  const promptText = buildRecommendationPrompt({ intentDecomposeJson });
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
        prompt: "recommendation",
        promptText,
        imageBase64: normalizedImageBase64,
        provider: "recommendation",
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
      throw new Error("Recommendation LLM response is empty.");
    }

    const recommendationJson =
      payload?.recommendation_json &&
      typeof payload.recommendation_json === "object" &&
      !Array.isArray(payload.recommendation_json)
        ? payload.recommendation_json
        : parseRecommendationResponse(rawText);
    const panelJson =
      payload?.panel_json && typeof payload.panel_json === "object" && !Array.isArray(payload.panel_json)
        ? payload.panel_json
        : null;
    return {
      rawText,
      recommendationJson,
      panelJson,
    };
  } finally {
    timeout.clear();
  }
}
