import { llmConfig } from "../config/llmConfig.js";
import { buildIntentPrompt } from "./intentPromptBuilder.js";
import { parseIntentResponse } from "./intentResponseParser.js";
import { validateIntentList } from "./intentSchemaValidator.js";

// 创建带超时能力的 AbortSignal，避免请求长时间挂起。
function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// 通过后端代理调用大模型：构建提示词、发起请求、解析并校验返回结果。
async function parseIntentWithYizhanProxy({ prompt, sourceData, imageBase64 }) {
  const promptText = buildIntentPrompt({ prompt, sourceData });
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
        sourceData,
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

// 对外统一入口：返回可直接用于后续更新流程的 intents。
export async function parseIntentWithLLM({
  prompt,
  sourceData,
  imageBase64 = null,
}) {
  return parseIntentWithYizhanProxy({
    prompt,
    sourceData,
    imageBase64,
  });
}
