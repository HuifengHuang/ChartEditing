function escapeScriptCloseTag(text) {
  return text.replace(/<\/script>/gi, "<\\/script>");
}

function sourceDataToCode(sourceData) {
  return `const source_data = ${JSON.stringify(sourceData, null, 2)};`;
}

export function buildChartHtml(parts) {
  const sourceDataCode = sourceDataToCode(parts.source_data).replace(/</g, "\\u003c");
  const renderCode = escapeScriptCloseTag(parts.render_code);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    ${parts.body}
    ${parts.import_script}
    <script>
${sourceDataCode}
${renderCode}
    </script>
  </body>
</html>`;
}
