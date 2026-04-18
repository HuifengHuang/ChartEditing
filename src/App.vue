<script setup>
import { computed, nextTick, ref } from "vue";
import CodePanel from "./components/CodePanel.vue";
import ChartPreview from "./components/ChartPreview.vue";
import ControlPanel from "./components/ControlPanel.vue";
import PromptBar from "./components/PromptBar.vue";
import {
  createSampleChartPartsMirroredMood,
  sourceDataMirroredMoodToCode,
} from "./data/sampleChartPartsMirroredMood";
import { samplePanelSpecMirroredMood } from "./specs/samplePanelSpecMirroredMood";
import { buildChartHtml } from "./utils/buildChartHtml";
import { parseIntent as parseIntentByRule } from "./utils/parseIntent";
import { intentToUpdatePlan } from "./utils/intentToUpdatePlan";
import { applyUpdatePlan } from "./utils/applyUpdatePlan";
import { parseIntentWithLLM } from "./llm/intentParserLLM.js";

const parts = ref(createSampleChartPartsMirroredMood());

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
const toasts = ref([]);
const llmImagePreviewEnabled = ref(true);
const llmImageModalOpen = ref(false);
const llmImageModalSrc = ref("");
const llmImageModalTitle = ref("");
let toastSeed = 0;

const sourceDataCode = computed(() => sourceDataMirroredMoodToCode(parts.value.source_data));
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

function closeLlmImageModal() {
  llmImageModalOpen.value = false;
}

function disableLlmImagePreview() {
  llmImagePreviewEnabled.value = false;
  closeLlmImageModal();
  pushToast("LLM image preview has been disabled.", "info");
}

function showLlmImageModal(imageBase64, title) {
  if (!llmImagePreviewEnabled.value) {
    return;
  }
  llmImageModalTitle.value = title;
  llmImageModalSrc.value = imageBase64
    ? `data:image/png;base64,${imageBase64}`
    : "";
  llmImageModalOpen.value = true;
}

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

async function captureCurrentChartImage() {
  await nextTick();
  const captureFn = chartPreviewRef.value?.captureChartImageBase64;
  if (typeof captureFn !== "function") {
    throw new Error("Preview capture function is unavailable.");
  }
  return captureFn();
}

async function resolveIntent(prompt) {
  const context = buildIntentContext();
  let imageBase64 = null;

  try {
    imageBase64 = await captureCurrentChartImage();
  } catch (error) {
    imageBase64 = null;
  }

  try {
    showLlmImageModal(
      imageBase64,
      imageBase64
        ? "LLM Request Preview (with image)"
        : "LLM Request Preview (text-only, no image)"
    );
    const intent = await parseIntentWithLLM({
      prompt,
      context,
      imageBase64,
    });
    pushToast(
      imageBase64
        ? "LLM parser succeeded with visual input."
        : "LLM parser succeeded (text-only).",
      "info"
    );
    return intent;
  } catch (visionError) {
    if (imageBase64) {
      try {
        showLlmImageModal(null, "LLM Retry Preview (text-only fallback)");
        const intent = await parseIntentWithLLM({
          prompt,
          context,
          imageBase64: null,
        });
        pushToast("Visual parse failed, text-only LLM succeeded.", "warning");
        return intent;
      } catch (textError) {
        pushToast("LLM failed (vision + text-only), fallback to rule parser.", "warning");
        return parseIntentByRule(prompt);
      }
    }

    pushToast("LLM failed, fallback to rule parser.", "warning");
    return parseIntentByRule(prompt);
  }
}

async function handlePromptSubmit(payload) {
  if (busy.value) {
    return;
  }

  const prompt = String(payload || "").trim();
  if (!prompt) {
    return;
  }

  busy.value = true;

  try {
    const intent = await resolveIntent(prompt);
    const updatePlan = intentToUpdatePlan(intent, parts.value, panelSpec.value);
    const nextState = applyUpdatePlan(parts.value, panelSpec.value, updatePlan);
    parts.value = nextState.parts;
    panelSpec.value = nextState.panelSpec;
    pushToast(`Last Intent: ${intent.task} (${intent.action})`, "success");
  } catch (error) {
    pushToast(error?.message || "Intent parsing failed.", "error", 4200);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="workbench">
    <header class="workbench-header">
      <div class="header-main">
        <div>
          <h1>Chart Editing Workbench</h1>
          <p>Prompt -> Intent -> UpdatePlan -> source_data/panelSpec -> live preview</p>
        </div>
        <label class="preview-toggle">
          <input v-model="llmImagePreviewEnabled" type="checkbox" />
          <span>Show LLM Image Preview</span>
        </label>
      </div>
    </header>

    <PromptBar
      :busy="busy"
      @submit-prompt="handlePromptSubmit"
    />

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

    <div v-if="llmImageModalOpen" class="image-modal-mask" @click.self="closeLlmImageModal">
      <section class="image-modal">
        <header class="image-modal-header">
          <h3>{{ llmImageModalTitle }}</h3>
        </header>
        <div class="image-modal-body">
          <img v-if="llmImageModalSrc" :src="llmImageModalSrc" alt="LLM request preview" />
          <p v-else>No image was sent in this request.</p>
        </div>
        <footer class="image-modal-footer">
          <button type="button" class="ghost-btn" @click="closeLlmImageModal">Close</button>
          <button type="button" class="danger-btn" @click="disableLlmImagePreview">Close This Feature</button>
        </footer>
      </section>
    </div>

    <section class="workbench-grid">
      <div class="left-column">
        <CodePanel :source-data-code="sourceDataCode" :render-code="parts.render_code" />
      </div>

      <div class="center-column">
        <ChartPreview ref="chartPreviewRef" :html-content="htmlContent" />
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

.workbench-header p {
  margin: 4px 0 0;
  color: #d1d5db;
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #e5e7eb;
  user-select: none;
}

.preview-toggle input {
  accent-color: #60a5fa;
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

.image-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
}

.image-modal {
  width: min(860px, 96vw);
  max-height: 92vh;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.image-modal-header {
  padding: 12px 14px;
  border-bottom: 1px solid #e5e7eb;
}

.image-modal-header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.image-modal-body {
  padding: 12px;
  overflow: auto;
  min-height: 200px;
  background: #f8fafc;
}

.image-modal-body img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  margin: 0 auto;
}

.image-modal-body p {
  margin: 0;
  color: #334155;
  font-size: 13px;
  text-align: center;
}

.image-modal-footer {
  padding: 10px 12px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ghost-btn,
.danger-btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  border-radius: 8px;
  font-size: 12px;
  padding: 7px 10px;
  cursor: pointer;
}

.danger-btn {
  border-color: #fecaca;
  color: #b91c1c;
}

.workbench-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 350px minmax(520px, 1fr) 320px;
  gap: 12px;
  align-items: stretch;
}

.left-column,
.center-column,
.right-column {
  min-height: 0;
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
