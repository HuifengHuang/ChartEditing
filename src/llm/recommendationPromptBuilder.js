import recommendationTemplate from "../prompts/recommendationTemplate.txt?raw";

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function normalizeTemplate(rawTemplate) {
  const text = String(rawTemplate || "").trim();
  if (!text) {
    return [
      "你是图表编辑系统的推荐生成器。",
      "请严格返回 JSON，不要返回 markdown，不要解释。",
    ].join("\n");
  }
  return text;
}

// 构建推荐阶段提示词：模板 + 意图分解 JSON + 图片说明。
export function buildRecommendationPrompt({ intentDecomposeJson }) {
  const templateText = normalizeTemplate(recommendationTemplate);
  return [
    templateText,
    "",
    "【意图分解JSON】",
    safeJson(intentDecomposeJson || {}),
    "",
    "【Image】",
    "图表图片已作为多模态输入单独附加，请结合图片与意图分解 JSON 生成推荐结果。",
    "",
    "请只返回合法 JSON。",
  ].join("\n");
}

