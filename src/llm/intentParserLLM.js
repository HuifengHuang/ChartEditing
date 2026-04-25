import { llmConfig } from "../config/llmConfig.js";
import { buildIntentPrompt } from "./intentPromptBuilder.js";
import { parseIntentResponse } from "./intentResponseParser.js";
import { validateIntentList } from "./intentSchemaValidator.js";

// 统一创建超时控制信号，避免请求长期挂起。
function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// 通过后端代理调用 LLM 并返回规范化意图列表。
async function parseIntentWithYizhanProxy({ prompt, context, imageBase64 }) {
  const promptText = buildIntentPrompt({ prompt, context });
  // 仅在有图像时传入 base64，文本模式传 null。
  const normalizedImageBase64 =
    typeof imageBase64 === "string" && imageBase64.trim() ? imageBase64.trim() : null;
  const timeout = createAbortSignal(llmConfig.timeoutMs);

  try {
    // 后端代理负责鉴权与上游适配，前端只关心标准化返回。
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

// 暴露统一入口：当前默认走 Yizhan 代理实现。
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
