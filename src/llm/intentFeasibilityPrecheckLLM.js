import { llmConfig } from "../config/llmConfig.js";
import { buildIntentFeasibilityPrecheckPrompt } from "./intentFeasibilityPrecheckPromptBuilder.js";

// 创建超时控制，避免请求无限等待。
function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// 兼容后端不同字段，统一抽取模型文本结果。
function normalizeRawText(payload) {
  return String(payload?.raw_text || payload?.text || "").trim();
}

// 尝试解析 JSON 文本，失败时返回 null。
function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// 从模型输出中提取 JSON（支持代码围栏或前后混入说明文本）。
function extractJsonObject(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed) {
      return parsed;
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = tryParse(text.slice(firstBrace, lastBrace + 1));
    if (parsed) {
      return parsed;
    }
  }

  return tryParse(text);
}

// 标准化字段候选，保证下游读取稳定。
function normalizeFieldCandidates(rawList) {
  if (!Array.isArray(rawList)) {
    return [];
  }
  return rawList
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      path: String(item.path || "").trim(),
      type: String(item.type || "").trim(),
      value: item.value,
    }))
    .filter((item) => item.path);
}

// 标准化单个预判断意图对象。
function normalizePrecheckIntent(item, index) {
  const intent = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  return {
    intent_name: String(intent.intent_name || `Intent ${index + 1}`).trim() || `Intent ${index + 1}`,
    needs_render_update: intent.needs_render_update === true,
    field_candidates: normalizeFieldCandidates(intent.field_candidates),
    reason: String(intent.reason || "").trim(),
  };
}

// 标准化预判断结果：保证 intents/all_data_only 字段总是存在。
function normalizePrecheckJson(payload) {
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const intents = Array.isArray(root.intents)
    ? root.intents.map((item, index) => normalizePrecheckIntent(item, index))
    : [];
  const allDataOnly =
    root.all_data_only === true ||
    (intents.length > 0 && intents.every((item) => item.needs_render_update === false));

  return {
    intents,
    all_data_only: Boolean(allDataOnly),
  };
}

// 调用模型执行“意图可行性预判断”。
export async function parseIntentFeasibilityPrecheckWithLLM({
  prompt,
  sourceData,
  imageBase64 = null,
}) {
  const promptText = buildIntentFeasibilityPrecheckPrompt({ prompt, sourceData });
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
        prompt: "intent_feasibility_precheck",
        promptText,
        sourceData,
        imageBase64: normalizedImageBase64,
        provider: "intent_feasibility_precheck",
      }),
      signal: timeout.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const rawText = normalizeRawText(payload);
    if (!rawText) {
      throw new Error("Intent feasibility precheck response is empty.");
    }

    const parsed = extractJsonObject(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Intent feasibility precheck returned invalid JSON.");
    }

    const precheckJson = normalizePrecheckJson(parsed);
    return {
      rawText,
      precheckJson,
    };
  } finally {
    timeout.clear();
  }
}
