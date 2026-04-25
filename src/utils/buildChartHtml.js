function sourceDataToCode(sourceData) {
  return `const source_data = ${JSON.stringify(sourceData, null, 2)};`;
}

const SOURCE_DATA_PLACEHOLDER = "/*__SOURCE_DATA__*/";

export function buildChartHtml(parts) {
  const sourceDataCode = sourceDataToCode(parts.source_data).replace(/</g, "\\u003c");
  const mainScript = String(parts?.main_script || "").trim();
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
