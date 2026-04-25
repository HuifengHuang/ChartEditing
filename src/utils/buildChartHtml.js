// 将 source_data 对象转成内联脚本中的常量声明。
function sourceDataToCode(sourceData) {
  return `const source_data = ${JSON.stringify(sourceData, null, 2)};`;
}

const SOURCE_DATA_PLACEHOLDER = "/*__SOURCE_DATA__*/";

export function buildChartHtml(parts) {
  // 将 source_data 序列化为可直接执行的 JS 代码。
  // 额外转义 "<"，避免被浏览器误判为标签片段造成脚本截断。
  const sourceDataCode = sourceDataToCode(parts.source_data).replace(/</g, "\\u003c");
  const mainScript = String(parts?.main_script || "").trim();
  // 优先替换预留占位符；没有占位符时则默认前置注入。
  const injectedScript = mainScript.includes(SOURCE_DATA_PLACEHOLDER)
    ? mainScript.replace(SOURCE_DATA_PLACEHOLDER, sourceDataCode)
    : `${sourceDataCode}\n${mainScript}`;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    ${injectedScript}
  </body>
</html>`;
}
