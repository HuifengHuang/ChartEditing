import { extractSourceDataFromHtmlWithLLM } from "../llm/chartCodeGeneratorLLM.js";

const SOURCE_DATA_PLACEHOLDER = "/*__SOURCE_DATA__*/";
const D3_CDN_URL = "https://cdn.jsdelivr.net/npm/d3@7";

// 去掉 ```html ... ``` 代码围栏，统一得到纯 HTML 文本。
function stripCodeFence(raw) {
  const text = String(raw || "").trim();
  const fenceMatch = text.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : text;
}

function stripStaticStyles(doc) {
  // 清理静态样式，保证样式由 D3 运行时控制。
  doc.querySelectorAll("style").forEach((node) => {
    node.remove();
  });
  doc.querySelectorAll("[style]").forEach((node) => {
    node.removeAttribute("style");
  });
}

// 收集外链脚本并去重；如果缺少 D3 则自动补默认 CDN。
function collectExternalScriptUrls(doc) {
  const urls = [];
  doc.querySelectorAll("script[src]").forEach((script) => {
    const src = String(script.getAttribute("src") || "").trim();
    if (src) {
      urls.push(src);
    }
  });

  const uniqueUrls = Array.from(new Set(urls));
  const hasD3 = uniqueUrls.some((url) => /(^|\/)d3(@|\.min\.js|\.js|$)/i.test(url));
  if (!hasD3) {
    uniqueUrls.unshift(D3_CDN_URL);
  }
  return uniqueUrls;
}

// 处理内联脚本中的 `</script>`，防止字符串拼接时提前闭合标签。
function sanitizeInlineScript(scriptText) {
  return String(scriptText || "").replace(/<\/script/gi, "<\\/script");
}

// 将模型返回的 HTML 拆分为系统模板结构：{ source_data, main_script }。
export async function htmlToChartParts(rawHtml) {
  const normalizedHtml = stripCodeFence(rawHtml);
  if (!normalizedHtml) {
    throw new Error("LLM returned empty HTML.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(normalizedHtml, "text/html");
  stripStaticStyles(doc);

  const externalScriptUrls = collectExternalScriptUrls(doc);

  // 记录“原始是否有内联脚本”，用于校验 LLM 返回结果是否完整。
  const inlineScriptRaw = Array.from(doc.querySelectorAll("script:not([src])"))
    .map((node) => String(node.textContent || "").trim())
    .filter(Boolean)
    .join("\n\n");

  // source_data 完全由 LLM 提取，不使用本地规则解析。
  const extracted = await extractSourceDataFromHtmlWithLLM({ html: normalizedHtml });
  const cleanedInlineScript = String(extracted?.cleaned_inline_script || "").trim();

  // 如果原始有脚本但模型未返回清洗后脚本，直接报错避免生成不可执行模板。
  if (inlineScriptRaw && !cleanedInlineScript) {
    throw new Error("LLM source_data extraction did not return cleaned script.");
  }

  // body 里只保留结构标签，移除 script/style，避免后续重复注入。
  const bodyClone = doc.body ? doc.body.cloneNode(true) : document.createElement("body");
  bodyClone.querySelectorAll("script, style").forEach((node) => node.remove());

  const bodyMarkup = String(bodyClone.innerHTML || "").trim();
  const scriptTagMarkup = externalScriptUrls
    .map((url) => `<script src="${url}"></script>`)
    .join("\n");

  const inlineScript = sanitizeInlineScript(cleanedInlineScript);
  const mainScriptSections = [];
  if (bodyMarkup) {
    mainScriptSections.push(bodyMarkup);
  }
  if (scriptTagMarkup) {
    mainScriptSections.push(scriptTagMarkup);
  }

  const scriptContent = inlineScript
    ? `${SOURCE_DATA_PLACEHOLDER}\n\n${inlineScript}`
    : SOURCE_DATA_PLACEHOLDER;

  // 占位符由 buildChartHtml() 统一替换为 `const source_data = ...`。
  mainScriptSections.push(`<script>\n${scriptContent}\n<\/script>`);

  return {
    source_data: extracted.source_data,
    main_script: mainScriptSections.join("\n").trim(),
  };
}
