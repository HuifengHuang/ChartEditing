import intentDecomposeTemplate from "../prompts/intentDecomposeTemplate.txt?raw";

// 安全序列化对象，避免循环引用导致 JSON.stringify 报错。
function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

// 规范化模板文本；当模板为空时提供兜底模板。
function normalizeTemplate(rawTemplate) {
  const text = String(rawTemplate || "").trim();
  if (!text) {
    return [
      "你是图表编辑系统的意图分解器。",
      "请严格返回 JSON，不要返回 markdown，不要解释。",
      "",
      "输出结构：",
      "{",
      '  "intent": "string",',
      '  "target": "string",',
      '  "attributes": [],',
      '  "affected": []',
      "}",
    ].join("\n");
  }
  return text;
}

// 构建意图分解提示词，注入用户输入、source_data 和图片说明。
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
    "图表图片已作为多模态输入单独附加，请结合图片 + source_data + 用户输入进行意图分解。",
    "",
    "请只返回合法 JSON。",
  ].join("\n");
}
