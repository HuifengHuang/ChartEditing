import { llmConfig } from "../config/llmConfig.js";

const DEFAULT_PREVIEW_MAX_WIDTH = 980;
const DEFAULT_PREVIEW_MAX_HEIGHT = 720;

const HTML_TO_TEMPLATE_PARTS_PROMPT_HEADER = [
  "你将收到一段完整的 HTML 图表代码。",
  "请提取以下四个字段，并只返回严格 JSON：",
  "1) title：HTML 的标题文本（不含 <title> 标签）。",
  "2) import_script：需要放在 <head> 中的脚本引入字符串（可多行 script 标签）。",
  "3) source_data：可编辑数据与样式对象（必须是对象）。",
  "4) render_script：图表渲染脚本（必须是字符串，且不要包含 const source_data = ... 定义）。",
  "关键要求：render_script 必须包含绘图所需 DOM 的创建代码（例如 svg/container 创建），不能依赖 body 中已有静态标签。",
  "输出要求：",
  "- 只能输出 JSON，不要 Markdown，不要解释。",
  '- JSON 结构必须是：{"title":"...","import_script":"...","source_data":{...},"render_script":"..."}',
  "- title/import_script/render_script 都必须是字符串；source_data 必须是对象。",
  "- import_script 为空时返回空字符串。",
  "以下是待处理 HTML：",
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

// 归一化预览区最大尺寸，避免非法数值进入提示词。
function normalizePreviewMaxSize(previewMaxSize) {
  const width = Number(previewMaxSize?.maxWidth);
  const height = Number(previewMaxSize?.maxHeight);
  return {
    maxWidth: Number.isFinite(width) && width > 0 ? Math.round(width) : DEFAULT_PREVIEW_MAX_WIDTH,
    maxHeight: Number.isFinite(height) && height > 0 ? Math.round(height) : DEFAULT_PREVIEW_MAX_HEIGHT,
  };
}

// 动态构建“图片转 HTML”提示词，明确 Chart Preview 最大尺寸限制。
function buildImageToHtmlPrompt(previewMaxSize) {
  const { maxWidth, maxHeight } = normalizePreviewMaxSize(previewMaxSize);
  return [
    "根据这个图表图片，生成一份完整的html代码，要求如下：",
    "1、使用D3.js绘图",
    "2、不要写css，样式使用D3实现",
    "3、将可能会修改的所有数据和所有样式，统一定义在 source_data 变量中。",
    `4、Chart Preview 可用最大尺寸（已考虑容器留白）约为 width=${maxWidth}px, height=${maxHeight}px。请参考该限制设置图表画布（例如 source_data.width/source_data.height）。`,
    "5、请尽量联动调整所有必要参数以保证适配效果，包括但不限于：layout间距、图元位置、标题/副标题位置、字号、行高、bar间距、比例尺范围与偏移。",
    "6、渲染结果应尽量完整显示：不裁切、不溢出、不过度贴边，视觉上尽量与预览区域匹配。",
    "7、不要输出任何解释说明，直接给我html代码。",
  ].join(" ");
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

// 去掉模型可能返回的 ```code fence``` 包装。
function stripCodeFence(rawText) {
  const text = String(rawText || "").trim();
  const fenced = text.match(/^```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : text;
}

// 统一的代理请求函数：图片生成 HTML、HTML 字段提取都复用它。
async function requestYizhan({ promptText, context = {}, imageBase64 = null }) {
  const timeout = createAbortSignal(llmConfig.timeoutMs);
  try {
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

// 第一步：输入图片，生成完整图表 HTML。
export async function generateChartHtmlFromImage({ imageBase64, previewMaxSize = null }) {
  const normalizedImageBase64 =
    typeof imageBase64 === "string" && imageBase64.trim() ? imageBase64.trim() : "";
  if (!normalizedImageBase64) {
    throw new Error("Image data is required.");
  }

  const normalizedSize = normalizePreviewMaxSize(previewMaxSize);
  const promptText = buildImageToHtmlPrompt(normalizedSize);

  return requestYizhan({
    promptText,
    context: {
      task: "image_to_d3_html",
      preview_max_size: normalizedSize,
    },
    imageBase64: normalizedImageBase64,
  });
}

// 第二步：输入完整 HTML，提取模板四段字段。
export async function extractHtmlTemplatePartsWithLLM({ html }) {
  const normalizedHtml = typeof html === "string" ? html.trim() : "";
  if (!normalizedHtml) {
    throw new Error("HTML input is required.");
  }

  const promptText = `${HTML_TO_TEMPLATE_PARTS_PROMPT_HEADER}\n${normalizedHtml}`;
  const rawText = await requestYizhan({
    promptText,
    context: { task: "extract_html_template_parts" },
    imageBase64: null,
  });

  const jsonText = extractJsonBlock(rawText);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("LLM html template extraction returned invalid JSON.");
  }

  const title = typeof parsed?.title === "string" ? parsed.title.trim() : "";
  const importScript = stripCodeFence(parsed?.import_script);
  const renderScript = stripCodeFence(parsed?.render_script);
  const sourceData = parsed?.source_data;

  if (!sourceData || typeof sourceData !== "object" || Array.isArray(sourceData)) {
    throw new Error("LLM html template extraction missing source_data object.");
  }
  if (!renderScript) {
    throw new Error("LLM html template extraction missing render_script.");
  }

  return {
    title: title || "Chart Preview",
    import_script: importScript,
    source_data: JSON.parse(JSON.stringify(sourceData)),
    render_script: renderScript,
  };
}
