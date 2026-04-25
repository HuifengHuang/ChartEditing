<script setup>
import { computed, nextTick, ref } from "vue";
import CodePanel from "./components/CodePanel.vue";
import ChartPreview from "./components/ChartPreview.vue";
import ControlPanel from "./components/ControlPanel.vue";
import {
  createSampleChartPartsMirroredMood,
} from "./data/sampleChartPartsMirroredMood";
import { samplePanelSpecMirroredMood } from "./specs/samplePanelSpecMirroredMood";
import { buildChartHtml } from "./utils/buildChartHtml";
import { parseIntent as parseIntentByRule } from "./utils/parseIntent";
import { intentToUpdatePlan } from "./utils/intentToUpdatePlan";
import { applyUpdatePlan } from "./utils/applyUpdatePlan";
import { parseIntentWithLLM } from "./llm/intentParserLLM.js";
import { generateChartHtmlFromImage } from "./llm/chartCodeGeneratorLLM.js";
import { htmlToChartParts } from "./utils/htmlToChartParts.js";

const parts = ref(createSampleChartPartsMirroredMood());

// 创建“空控件面板”状态：保留基础 uiState，清空 section 内容。

function createEmptyPanelSpec() {
  const base = structuredClone(samplePanelSpecMirroredMood);
  base.sections = [];
  base.uiState = {
    expandedSections: [],
    highlightedSectionId: null,
  };
  return base;
}

const panelSpec = ref(createEmptyPanelSpec());
const chartPreviewRef = ref(null);

const busy = ref(false);
const llmResponseTick = ref(0);
const toasts = ref([]);
const isPreviewVisible = ref(true);
const previewPlaceholderText = ref("No chart entered");
let toastSeed = 0;

const htmlContent = computed(() => buildChartHtml(parts.value));

// 统一消息提示入口，负责入队和自动回收。

function pushToast(message, type = "info", timeoutMs = 2800) {
  const text = String(message || "").trim();
  if (!text) {
    return;
  }
  const id = `toast_${Date.now()}_${toastSeed++}`;
  toasts.value.push({ id, type, message: text });
  setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }, timeoutMs);
}

// 将多种返回形态统一为意图数组，便于后续顺序执行。
function ensureIntentArray(rawIntents) {
  if (Array.isArray(rawIntents)) {
    return rawIntents.filter((item) => item && typeof item === "object");
  }
  if (rawIntents && typeof rawIntents === "object") {
    return [rawIntents];
  }
  return [];
}

// 组织给 LLM 的上下文信息，帮助模型理解当前编辑态。
function buildIntentContext() {
  const sections = panelSpec.value?.sections || [];
  const sectionSummary = sections.map((section) => ({
    sectionId: section.sectionId,
    priority: section.priority,
    controlIds: (section.controls || []).map((control) => control.id),
  }));

  return {
    chartType: "mirrored horizontal bar chart",
    fields: ["month", "waitingArea", "corridor"],
    supportedTasks: [
      "aspect_ratio",
      "color_theme",
      "element_edit",
      "legend_edit",
    ],
    panelSummary: {
      sectionCount: sections.length,
      sections: sectionSummary,
      expandedSections: panelSpec.value?.uiState?.expandedSections || [],
      highlightedSectionId: panelSpec.value?.uiState?.highlightedSectionId || null,
    },
  };
}

// 从当前预览区域抓图，提供给视觉意图解析。
async function captureCurrentChartImage() {
  await nextTick();
  const captureFn = chartPreviewRef.value?.captureChartImageBase64;
  if (typeof captureFn !== "function") {
    throw new Error("Preview capture function is unavailable.");
  }
  return captureFn();
}

// 解析意图：优先“图文 LLM”，失败降级“文本 LLM”，再失败降级规则解析。
async function resolveIntent({ prompt, userImageBase64 = null }) {
  const context = buildIntentContext();
  let imageBase64 = typeof userImageBase64 === "string" && userImageBase64.trim() ? userImageBase64.trim() : null;

  if (!imageBase64) {
    try {
      imageBase64 = await captureCurrentChartImage();
    } catch (error) {
      imageBase64 = null;
    }
  }

  try {
    const intents = ensureIntentArray(
      await parseIntentWithLLM({
        prompt,
        context,
        imageBase64,
      })
    );
    const countText = intents.length > 1 ? `${intents.length} intents` : "1 intent";
    pushToast(
      imageBase64
        ? `LLM parser succeeded with visual input (${countText}).`
        : `LLM parser succeeded (text-only, ${countText}).`,
      "info"
    );
    return intents;
  } catch (visionError) {
    if (imageBase64) {
      try {
        const intents = ensureIntentArray(
          await parseIntentWithLLM({
            prompt,
            context,
            imageBase64: null,
          })
        );
        pushToast("Visual parse failed, text-only LLM succeeded.", "warning");
        return intents;
      } catch (textError) {
        pushToast("LLM failed (vision + text-only), fallback to rule parser.", "warning");
        return ensureIntentArray(parseIntentByRule(prompt));
      }
    }

    pushToast("LLM failed, fallback to rule parser.", "warning");
    return ensureIntentArray(parseIntentByRule(prompt));
  }
}

// 处理文本输入：解析意图并把意图转成可执行更新。
async function handlePromptSubmit(payload) {
  // busy 期间不接收新请求，避免状态并发覆盖。
  if (busy.value) {
    return;
  }

  const normalizedPayload =
    payload && typeof payload === "object"
      ? payload
      : {
          prompt: String(payload || ""),
          imageBase64: null,
        };

  const prompt = String(normalizedPayload.prompt || "").trim();
  const userImageBase64 =
    typeof normalizedPayload.imageBase64 === "string" && normalizedPayload.imageBase64.trim()
      ? normalizedPayload.imageBase64.trim()
      : null;
  if (!prompt) {
    return;
  }

  busy.value = true;

  try {
    const intents = await resolveIntent({ prompt, userImageBase64 });
    if (!intents.length) {
      pushToast("No intent recognized.", "warning");
      return;
    }

    let nextParts = parts.value;
    let nextPanelSpec = panelSpec.value;
    // 多意图按用户提及顺序串行应用，保证可预期。
    intents.forEach((intent) => {
      const updatePlan = intentToUpdatePlan(intent, nextParts, nextPanelSpec);
      const nextState = applyUpdatePlan(nextParts, nextPanelSpec, updatePlan);
      nextParts = nextState.parts;
      nextPanelSpec = nextState.panelSpec;
    });

    parts.value = nextParts;
    panelSpec.value = nextPanelSpec;

    const intentSummary = intents.map((intent) => `${intent.task} (${intent.action})`).join(" + ");
    pushToast(`Intents: ${intentSummary}`, "success");
  } catch (error) {
    pushToast(error?.message || "Intent parsing failed.", "error", 4200);
  } finally {
    llmResponseTick.value += 1;
    busy.value = false;
  }
}

// 处理图片输入：图片 -> HTML -> chart parts -> 替换当前运行模板。
async function handleImageUploaded(payload) {
  // 图片链路与文本链路共用 busy 锁，保证一次只跑一条主流程。
  if (busy.value) {
    return;
  }

  const imageBase64 =
    typeof payload?.imageBase64 === "string" && payload.imageBase64.trim()
      ? payload.imageBase64.trim()
      : "";
  // 用户没带图时，尝试用当前图表截图补足视觉信息。
  if (!imageBase64) {
    pushToast("Image data is missing.", "warning");
    return;
  }

  // 处理中暂时隐藏预览，显示明确状态文案。
  busy.value = true;
  isPreviewVisible.value = false;
  previewPlaceholderText.value = "Analyzing image and generating chart...";

  // 第一优先：图文联合解析。
  try {
    // 上传图片后走双阶段 LLM：先生成 HTML，再抽取可编辑模板结构。
    const htmlText = await generateChartHtmlFromImage({ imageBase64 });
    const generatedParts = await htmlToChartParts(htmlText);
    parts.value = generatedParts;
    panelSpec.value = createEmptyPanelSpec();
    pushToast("Chart template generated from uploaded image.", "success");
  } catch (error) {
    pushToast(error?.message || "Failed to generate chart from image.", "error", 4200);
  } finally {
    isPreviewVisible.value = true;
    previewPlaceholderText.value = "No chart entered";
    llmResponseTick.value += 1;
    busy.value = false;
  }
}
</script>

<template>
  <main class="workbench">
    <header class="workbench-header">
      <h1>Chart Editing Workbench</h1>
    </header>

    <div class="toast-layer" aria-live="polite">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast-item"
        :class="`toast-${toast.type}`"
      >
        {{ toast.message }}
      </div>
    </div>

    <section class="workbench-grid">
      <div class="left-column">
        <CodePanel
          :busy="busy"
          :llm-response-tick="llmResponseTick"
          @submit-prompt="handlePromptSubmit"
          @image-uploaded="handleImageUploaded"
        />
      </div>

      <div class="center-column">
        <ChartPreview
          ref="chartPreviewRef"
          :html-content="htmlContent"
          :is-chart-visible="isPreviewVisible"
          :placeholder-text="previewPlaceholderText"
        />
      </div>

      <div class="right-column">
        <ControlPanel :parts="parts" :panel-spec="panelSpec" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.workbench {
  height: 100vh;
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workbench-header {
  background: linear-gradient(90deg, #0f172a, #1f2937);
  color: #f9fafb;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
}

.workbench-header h1 {
  margin: 0;
  font-size: 20px;
}

.toast-layer {
  position: fixed;
  top: 18px;
  right: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 50;
  pointer-events: none;
}

.toast-item {
  min-width: 240px;
  max-width: 360px;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 12px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
}

.toast-error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

.toast-warning {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.toast-success {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.toast-info {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1e3a8a;
}

.workbench-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(360px, 1.05fr) minmax(420px, 2.09fr) minmax(360px, 1.31fr);
  gap: 12px;
  align-items: stretch;
}

.left-column,
.center-column,
.right-column {
  min-height: 0;
  width: 100%;
}

.left-column > *,
.center-column > *,
.right-column > * {
  width: 100%;
}

.right-column {
  height: 100%;
}

@media (max-width: 1280px) {
  .workbench {
    overflow: auto;
  }

  .workbench-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, minmax(0, 1fr));
    min-height: 900px;
  }
}
</style>
