import intentFeasibilityPrecheckTemplate from "../prompts/intentFeasibilityPrecheckTemplate.txt?raw";

// 安全序列化 JSON，防止循环引用导致构建提示词失败。
function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

// 规范化模板内容，避免空模板时无法构造提示词。
function normalizeTemplate(rawTemplate) {
  const text = String(rawTemplate || "").trim();
  if (text) {
    return text;
  }
  return [
    "你是图表意图预判断器。",
    "输入包含 User input、source_data(JSON) 和图表图片。",
    "输出严格 JSON：{ intents: [...], all_data_only: true|false }。",
  ].join("\n");
}

// 构建预判断阶段提示词：仅注入用户意图与 source_data，不注入 render_script。
export function buildIntentFeasibilityPrecheckPrompt({ prompt, sourceData }) {
  const templateText = normalizeTemplate(intentFeasibilityPrecheckTemplate);
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
    "图像将通过多模态输入提供，无需在文本中重复。",
    "",
    "请仅输出 JSON。",
  ].join("\n");
}
