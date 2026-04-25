import { extractHtmlTemplatePartsWithLLM } from "../llm/chartCodeGeneratorLLM.js";

// 去掉 ```html ... ``` 代码围栏，统一得到纯 HTML 文本。
function stripCodeFence(raw) {
  const text = String(raw || "").trim();
  const fenceMatch = text.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : text;
}

// 将模型返回的完整 HTML 转成系统内部结构。
export async function htmlToChartParts(rawHtml) {
  const normalizedHtml = stripCodeFence(rawHtml);
  if (!normalizedHtml) {
    throw new Error("LLM returned empty HTML.");
  }

  // 第二步完全交给模型提取四段字段。
  const extracted = await extractHtmlTemplatePartsWithLLM({ html: normalizedHtml });

  return {
    source_data: extracted.source_data,
    html_template: {
      title: extracted.title,
      import_script: extracted.import_script,
      render_script: extracted.render_script,
    },
  };
}
