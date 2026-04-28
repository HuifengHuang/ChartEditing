import renderIncrementalUpdateTemplate from "../prompts/renderIncrementalUpdateTemplate.txt?raw";

// 安全序列化，避免提示词构建被异常对象打断。
function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

// 规范化模板文本，保证提示词始终可生成。
function normalizeTemplate(rawTemplate) {
  const text = String(rawTemplate || "").trim();
  if (text) {
    return text;
  }
  return [
    "你是图表增量修改器。",
    "请仅输出 source_data_ops 和 render_script_ops 的增量 JSON。",
  ].join("\n");
}

// 统一 render_script 展示格式，便于模型基于锚点做插入。
function normalizeRenderScriptText(renderScript) {
  if (Array.isArray(renderScript)) {
    return renderScript.map((line) => String(line ?? "")).join("\n");
  }
  return String(renderScript || "");
}

// 构建“渲染增量更新”提示词，输入仅包含需要改代码的子意图。
export function buildRenderIncrementalUpdatePrompt({
  renderRequiredIntents,
  sourceData,
  renderScript,
}) {
  const templateText = normalizeTemplate(renderIncrementalUpdateTemplate);
  return [
    templateText,
    "",
    "【需要改代码的子意图列表(JSON)】",
    safeJson(Array.isArray(renderRequiredIntents) ? renderRequiredIntents : []),
    "",
    "【source_data(JSON)】",
    safeJson(sourceData || {}),
    "",
    "【render_script】",
    normalizeRenderScriptText(renderScript),
    "",
    "【Image】",
    "图像将通过多模态输入提供，无需在文本中重复。",
    "",
    "请仅输出 JSON。",
  ].join("\n");
}
