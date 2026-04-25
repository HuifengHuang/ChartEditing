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

// 追加可执行 intents 结构约束，保证后续更新流程可直接消费。
function buildExecutionIntentSchemaHint() {
  return [
    "",
    "你还需要额外返回 `intents` 数组（供系统执行），每个 intent 必须符合：",
    "{",
    '  "intentId": "string",',
    '  "intentType": "style | data",',
    '  "task": "aspect_ratio | color_theme | element_edit | legend_edit",',
    '  "target": ["layout | style | data | legend"],',
    '  "action": "update | add | remove | show_panel",',
    '  "parameters": {},',
    '  "needPanel": true,',
    '  "panelStrategy": "create | extend | reuse",',
    '  "detailRequested": false',
    "}",
    "最终输出必须是单个 JSON 对象，并且至少包含：intent、target、attributes、affected、intents。",
  ].join("\n");
}

// 构建意图分解提示词，注入用户输入、source_data、上下文和图片说明。
export function buildIntentPrompt({ prompt, sourceData, context }) {
  const templateText = normalizeTemplate(intentDecomposeTemplate);

  return [
    templateText,
    buildExecutionIntentSchemaHint(),
    "",
    "【User input】",
    String(prompt || ""),
    "",
    "【source_data(JSON)】",
    safeJson(sourceData || {}),
    "",
    "【Context(JSON)】",
    safeJson(context || {}),
    "",
    "【Image】",
    "图表图片已作为多模态输入单独附加，请结合图片 + source_data + 用户输入进行意图分解。",
    "",
    "请只返回合法 JSON。",
  ].join("\n");
}
