import intentDecomposeTemplate from "../prompts/intentDecomposeTemplate.txt?raw";

// 安全序列化 JSON，避免循环引用导致构建提示词失败。
function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

// 当模板为空时使用默认兜底模板。
function normalizeTemplate(rawTemplate) {
  const text = String(rawTemplate || "").trim();
  if (!text) {
    return [
      "你是图表编辑系统中的意图分解器。",
      "请将用户输入拆解为 intents 数组并返回 JSON。",
      "只返回合法 JSON，不要解释。",
    ].join("\n");
  }
  return text;
}

// 构建意图分解提示词：模板 + 用户输入 + source_data + 图片说明。
export function buildIntentPrompt({ prompt, sourceData }) {
  const templateText = normalizeTemplate(intentDecomposeTemplate);

  return [
    templateText,
    "",
    "【User input】",
    String(prompt || ""),
    "",
    "【source_data(JSON)】",
    safeJson(sourceData || {}),
    "",
    "【Image】",
    "图表图片已作为多模态输入单独附加，请结合图片与 source_data 进行意图分解。",
    "",
    "请只返回合法 JSON。",
  ].join("\n");
}
