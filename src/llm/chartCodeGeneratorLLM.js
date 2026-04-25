import { llmConfig } from "../config/llmConfig.js";

const IMAGE_TO_HTML_PROMPT =
  "根据这个图表图片，生成一份完整的html代码，要求如下： 1、使用D3.js绘图 2、不要写css，样式使用D3 3、将可能会修改的所有数据和所有样式，统一定义在一个变量中。";

const HTML_TO_SOURCE_DATA_PROMPT_HEADER = [
  "你将收到一段完整的 HTML 图表代码。",
  "请完成两个任务：",
  "1) 提取可编辑的数据与样式变量，整理为 source_data 对象。",
  "2) 删除脚本中 source_data 的定义语句，返回删除后的脚本代码（保持其他逻辑不变）。",
  "输出要求：",
  "- 只能输出严格 JSON，不要输出 Markdown。",
  "- JSON 结构必须是：{\"source_data\": {...}, \"cleaned_inline_script\": \"...\"}",
  "- source_data 必须是对象，cleaned_inline_script 必须是字符串。",
  "下面是待处理的 HTML：",
].join("\n");

// 统一创建带超时的 AbortSignal。
function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// 兼容后端不同字段名，统一抽取文本主体。
function normalizeRawText(payload) {
  return String(payload?.raw_text || payload?.text || "").trim();
}

// 尝试从模型输出中提取 JSON 文本（兼容 ```json 包裹）。
function extractJsonBlock(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return "";
  }

  // 一些模型会包 Markdown 代码块，这里先解包再解析。
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text;
}

// 统一的代理请求函数：图像生成 HTML、HTML 提取 source_data 都复用它。
async function requestYizhan({ promptText, context = {}, imageBase64 = null }) {
  const timeout = createAbortSignal(llmConfig.timeoutMs);
  try {
    // 同一代理端点，通过 context.task 区分不同任务。
    const response = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: promptText,
        promptText,
        context,
        imageBase64,
        provider: "yizhan",
      }),
      signal: timeout.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload?.error ||
        payload?.message ||
        payload?.upstream?.error?.message ||
        `HTTP ${response.status}`;
      throw new Error(message);
    }

    const rawText = normalizeRawText(payload);
    if (!rawText) {
      throw new Error("LLM returned empty content.");
    }

    return rawText;
  } finally {
    timeout.clear();
  }
}

// 第一阶段：输入图像，生成完整图表 HTML。
export async function generateChartHtmlFromImage({ imageBase64 }) {
  const normalizedImageBase64 =
    typeof imageBase64 === "string" && imageBase64.trim() ? imageBase64.trim() : "";
  if (!normalizedImageBase64) {
    throw new Error("Image data is required.");
  }

  return requestYizhan({
    promptText: IMAGE_TO_HTML_PROMPT,
    context: { task: "image_to_d3_html" },
    imageBase64: normalizedImageBase64,
  });
}

// 第二阶段：输入 HTML，让 LLM 抽取 source_data 并返回去定义后的脚本。
export async function extractSourceDataFromHtmlWithLLM({ html }) {
  const normalizedHtml = typeof html === "string" ? html.trim() : "";
  if (!normalizedHtml) {
    throw new Error("HTML input is required.");
  }

  // 要求模型只返回 JSON，便于前端做严格解析。
  const promptText = `${HTML_TO_SOURCE_DATA_PROMPT_HEADER}\n${normalizedHtml}`;
  const rawText = await requestYizhan({
    promptText,
    context: { task: "extract_source_data_from_html" },
    imageBase64: null,
  });

  const jsonText = extractJsonBlock(rawText);
  // 这里必须是严格 JSON，失败直接抛错阻断后续流程。
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error("LLM source_data extraction returned invalid JSON.");
  }

  const sourceData = parsed?.source_data;
  const cleanedInlineScript = parsed?.cleaned_inline_script;

  if (!sourceData || typeof sourceData !== "object" || Array.isArray(sourceData)) {
    throw new Error("LLM source_data extraction missing source_data object.");
  }

  // 深拷贝一份，避免后续误改原始解析对象。
  return {
    source_data: JSON.parse(JSON.stringify(sourceData)),
    cleaned_inline_script: typeof cleanedInlineScript === "string" ? cleanedInlineScript.trim() : "",
  };
}
