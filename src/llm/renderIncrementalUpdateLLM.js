import { llmConfig } from "../config/llmConfig.js";
import { buildRenderIncrementalUpdatePrompt } from "./renderIncrementalUpdatePromptBuilder.js";

const ALLOWED_SOURCE_OPS = new Set(["add"]);
const ALLOWED_RENDER_OPS = new Set(["insert_before", "insert_after"]);

// 创建超时控制，避免请求长期挂起。
function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// 兼容后端字段差异，统一拿到文本响应。
function normalizeRawText(payload) {
  return String(payload?.raw_text || payload?.text || "").trim();
}

// 尝试 JSON.parse，失败时返回 null。
function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// 从模型文本中抽取 JSON 主体。
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

// 标准化 source_data 增量操作，只允许 add。
function normalizeSourceOps(rawList) {
  if (!Array.isArray(rawList)) {
    return [];
  }
  return rawList
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      op: String(item.op || "").trim(),
      path: String(item.path || "").trim(),
      value: item.value,
    }))
    .filter((item) => item.path);
}

// 标准化 render_script 增量操作，只允许 anchor 插入。
function normalizeRenderOps(rawList) {
  if (!Array.isArray(rawList)) {
    return [];
  }
  return rawList
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      op: String(item.op || "").trim(),
      anchor: String(item.anchor || "").trim(),
      content: String(item.content || ""),
    }))
    .filter((item) => item.anchor);
}

// 严格校验操作类型，防止模型输出全量修改动作。
function assertOnlyIncrementalOps({ sourceDataOps, renderScriptOps }) {
  const invalidSourceOp = sourceDataOps.find((item) => !ALLOWED_SOURCE_OPS.has(item.op));
  if (invalidSourceOp) {
    throw new Error(`Invalid source_data op: ${invalidSourceOp.op || "unknown"}. Only "add" is allowed.`);
  }

  const invalidRenderOp = renderScriptOps.find((item) => !ALLOWED_RENDER_OPS.has(item.op));
  if (invalidRenderOp) {
    throw new Error(
      `Invalid render_script op: ${invalidRenderOp.op || "unknown"}. Only "insert_before/insert_after" are allowed.`
    );
  }
}

// 调用模型生成 source_data/render_script 的增量更新计划。
export async function parseRenderIncrementalUpdateWithLLM({
  renderRequiredIntents,
  sourceData,
  renderScript,
  imageBase64 = null,
}) {
  const promptText = buildRenderIncrementalUpdatePrompt({
    renderRequiredIntents,
    sourceData,
    renderScript,
  });
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
        prompt: "render_incremental_update",
        promptText,
        sourceData,
        imageBase64: normalizedImageBase64,
        provider: "render_incremental_update",
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
      throw new Error("Render incremental update response is empty.");
    }

    const parsed = extractJsonObject(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Render incremental update returned invalid JSON.");
    }

    const sourceDataOps = normalizeSourceOps(parsed.source_data_ops);
    const renderScriptOps = normalizeRenderOps(parsed.render_script_ops);
    assertOnlyIncrementalOps({ sourceDataOps, renderScriptOps });

    return {
      rawText,
      incrementalJson: {
        source_data_ops: sourceDataOps,
        render_script_ops: renderScriptOps,
      },
    };
  } finally {
    timeout.clear();
  }
}
