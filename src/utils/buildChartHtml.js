// 将 source_data 对象转成内联脚本中的常量声明。
function sourceDataToCode(sourceData) {
  return `const source_data = ${JSON.stringify(sourceData, null, 2)};`;
}

// 防止脚本字符串中出现 </script> 导致标签提前闭合。
function sanitizeScriptText(scriptText) {
  return String(scriptText || "").replace(/<\/script/gi, "<\\/script");
}

// 去掉模型可能附带的代码围栏。
function stripCodeFence(rawText) {
  const text = String(rawText || "").trim();
  const fenced = text.match(/^```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : text;
}

// 归一化 import_script：支持 script 标签或纯 URL 文本，缺省时自动补 D3。
function normalizeImportScript(importScriptText) {
  const raw = stripCodeFence(importScriptText);
  if (!raw) {
    return '<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>';
  }

  if (/<script[\s>]/i.test(raw)) {
    return raw;
  }

  const urls = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!urls.length) {
    return '<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>';
  }
  return urls.map((url) => `<script src="${url}"></script>`).join("\n  ");
}

// 归一化 render_script：支持字符串或按行数组；去 script 包裹并移除重复的 source_data 定义。
function normalizeRenderScript(renderScriptText) {
  const rawScript = Array.isArray(renderScriptText)
    ? renderScriptText.map((line) => String(line ?? "")).join("\n")
    : renderScriptText;
  let script = stripCodeFence(rawScript);
  script = script.replace(/^\s*<script[^>]*>/i, "").replace(/<\/script>\s*$/i, "").trim();

  // 防止第二步提取仍带 source_data 定义导致重复声明报错。
  script = script.replace(
    /\b(?:const|let|var)\s+source_data\s*=\s*[\s\S]*?;\s*/gi,
    ""
  );

  return sanitizeScriptText(script);
}

// 清洗标题文本，避免注入标签。
function sanitizeTitle(title) {
  return String(title || "Chart Preview").replace(/[<>]/g, "").trim() || "Chart Preview";
}

// 按“title/import_script/source_data/render_script”模板重建 HTML。
export function buildChartHtml(parts) {
  const template = parts?.html_template || {};
  const title = sanitizeTitle(template.title);
  const importScript = normalizeImportScript(template.import_script);
  const sourceDataCode = sourceDataToCode(parts?.source_data || {}).replace(/</g, "\\u003c");
  const renderScript = normalizeRenderScript(template.render_script);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${importScript}
</head>
<body>
  <script>
      ${sourceDataCode}
      ${renderScript}
  <\/script>
</body>
</html>`;
}
