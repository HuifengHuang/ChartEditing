<script setup>
import { computed, nextTick, ref, toRaw } from "vue";
import UserInput from "./components/CodePanel.vue";
import ChartPreview from "./components/ChartPreview.vue";
import ControlPanel from "./components/ControlPanel.vue";
import presetChart from "./data/preset_chart.json";
import { samplePanelSpecMirroredMood } from "./specs/samplePanelSpecMirroredMood";
import { buildChartHtml } from "./utils/buildChartHtml";
import { intentToUpdatePlan } from "./utils/intentToUpdatePlan";
import { applyUpdatePlan } from "./utils/applyUpdatePlan";
import { runtimeModeConfig } from "./config/runtimeModeConfig.js";
import { parseIntentWithLLM } from "./llm/intentParserLLM.js";
import { parseRecommendationWithLLM } from "./llm/recommendationLLM.js";
import { generateChartHtmlFromImage } from "./llm/chartCodeGeneratorLLM.js";
import { htmlToChartParts } from "./utils/htmlToChartParts.js";

function createEmptyChartParts() {
  return {
    source_data: {},
    html_template: {
      title: "Chart Preview",
      import_script: "",
      render_script: "",
    },
  };
}

function createChartPartsFromPresetChart() {
  return {
    source_data: structuredClone(presetChart.source_data || {}),
    html_template: {
      title: presetChart.title || "Chart Preview",
      import_script: presetChart.import_script || "",
      render_script: presetChart.render_script || "",
    },
  };
}

function createEmptyPanelSpec() {
  const base = structuredClone(samplePanelSpecMirroredMood);
  base.sections = [];
  base.uiState = {
    expandedSections: [],
    highlightedSectionId: null,
  };
  return base;
}

function safeDeepClone(value, fallback = {}) {
  try {
    return structuredClone(toRaw(value));
  } catch {
    try {
      return JSON.parse(JSON.stringify(toRaw(value)));
    } catch {
      return fallback;
    }
  }
}

const parts = ref(
  runtimeModeConfig.isDevelopment
    ? createChartPartsFromPresetChart()
    : createEmptyChartParts()
);
const panelSpec = ref(createEmptyPanelSpec());
const chartPreviewRef = ref(null);

const busy = ref(false);
const llmResponseTick = ref(0);
const toasts = ref([]);
const isPreviewVisible = ref(runtimeModeConfig.isDevelopment);
const previewPlaceholderText = ref(runtimeModeConfig.isDevelopment ? "" : "No chart entered");
let toastSeed = 0;

const htmlContent = computed(() => buildChartHtml(parts.value));

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

function ensureIntentArray(rawIntents) {
  if (Array.isArray(rawIntents)) {
    return rawIntents.filter((item) => item && typeof item === "object");
  }
  if (rawIntents && typeof rawIntents === "object") {
    return [rawIntents];
  }
  return [];
}

async function runIntentAndRecommendation({ prompt, sourceData, imageBase64 }) {
  const intentResult = await parseIntentWithLLM({
    prompt,
    sourceData,
    imageBase64,
  });
  const intents = ensureIntentArray(intentResult?.intents);
  const intentDecomposeJson =
    intentResult?.decomposeJson && typeof intentResult.decomposeJson === "object"
      ? intentResult.decomposeJson
      : { intents };

  const recommendationResult = await parseRecommendationWithLLM({
    intentDecomposeJson,
    imageBase64,
  });

  return {
    intents,
    intentDecomposeJson,
    recommendationJson: recommendationResult?.recommendationJson || {},
  };
}

async function captureCurrentChartImage() {
  await nextTick();
  const captureFn = chartPreviewRef.value?.captureChartImageBase64;
  if (typeof captureFn !== "function") {
    throw new Error("Preview capture function is unavailable.");
  }
  return captureFn();
}

async function resolveIntent({ prompt, userImageBase64 = null }) {
  const sourceData = safeDeepClone(parts.value?.source_data, {});
  let imageBase64 =
    typeof userImageBase64 === "string" && userImageBase64.trim() ? userImageBase64.trim() : null;

  if (!imageBase64) {
    try {
      imageBase64 = await captureCurrentChartImage();
    } catch {
      imageBase64 = null;
    }
  }

  try {
    const result = await runIntentAndRecommendation({
      prompt,
      sourceData,
      imageBase64,
    });
    const intents = result.intents;
    const countText = intents.length > 1 ? `${intents.length} intents` : "1 intent";
    pushToast(
      imageBase64
        ? `LLM parser succeeded with visual input (${countText}).`
        : `LLM parser succeeded (text-only, ${countText}).`,
      "info"
    );
    const recommendationRequired = result.recommendationJson?.recommendationRequired === true;
    pushToast(
      recommendationRequired
        ? "Recommendation model succeeded (presets generated)."
        : "Recommendation model succeeded.",
      "success"
    );
    return intents;
  } catch (visionError) {
    if (imageBase64) {
      try {
        const result = await runIntentAndRecommendation({
          prompt,
          sourceData,
          imageBase64: null,
        });
        const intents = result.intents;
        pushToast("Visual parse failed, text-only LLM succeeded (intent + recommendation).", "warning");
        const recommendationRequired = result.recommendationJson?.recommendationRequired === true;
        pushToast(
          recommendationRequired
            ? "Recommendation model succeeded (presets generated)."
            : "Recommendation model succeeded.",
          "success"
        );
        return intents;
      } catch (textError) {
        const visionMessage = visionError?.message ? ` vision=${visionError.message};` : "";
        const textMessage = textError?.message ? ` text=${textError.message};` : "";
        throw new Error(`LLM failed (vision + text-only).${visionMessage}${textMessage}`);
      }
    }

    throw new Error(`LLM failed: ${visionError?.message || "unknown error"}`);
  }
}

async function handlePromptSubmit(payload) {
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

async function handleImageUploaded(payload) {
  if (busy.value) {
    return;
  }

  const imageBase64 =
    typeof payload?.imageBase64 === "string" && payload.imageBase64.trim()
      ? payload.imageBase64.trim()
      : "";

  if (!imageBase64) {
    pushToast("Image data is missing.", "warning");
    return;
  }

  if (runtimeModeConfig.isDevelopment) {
    parts.value = createChartPartsFromPresetChart();
    panelSpec.value = createEmptyPanelSpec();
    isPreviewVisible.value = true;
    previewPlaceholderText.value = "";
    llmResponseTick.value += 1;
    pushToast("Development mode: loaded preset_chart.json without LLM call.", "info");
    return;
  }

  busy.value = true;
  isPreviewVisible.value = false;
  previewPlaceholderText.value = "Analyzing image and generating chart...";
  let generated = false;

  try {
    const htmlText = await generateChartHtmlFromImage({ imageBase64 });
    const generatedParts = await htmlToChartParts(htmlText);
    parts.value = generatedParts;
    panelSpec.value = createEmptyPanelSpec();
    generated = true;
    pushToast("Chart template generated from uploaded image.", "success");
  } catch (error) {
    pushToast(error?.message || "Failed to generate chart from image.", "error", 4200);
  } finally {
    isPreviewVisible.value = generated;
    previewPlaceholderText.value = generated ? "" : "No chart entered";
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
        <UserInput
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
