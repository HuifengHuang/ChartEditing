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
import { parseIntentFeasibilityPrecheckWithLLM } from "./llm/intentFeasibilityPrecheckLLM.js";
import { parseRenderIncrementalUpdateWithLLM } from "./llm/renderIncrementalUpdateLLM.js";
import { generateChartHtmlFromImage } from "./llm/chartCodeGeneratorLLM.js";
import { htmlToChartParts } from "./utils/htmlToChartParts.js";
import { buildRecommendationPanelPlan } from "./utils/recommendationPanelPlan.js";
import { applyIncrementalRenderUpdate } from "./utils/applyIncrementalRenderUpdate.js";

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
  base.title = samplePanelSpecMirroredMood?.title || "Visual Panels";
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
const panelGroups = ref([]);
const chartPreviewRef = ref(null);
const controlPanelRef = ref(null);

const busy = ref(false);
const llmResponseTick = ref(0);
const chartRenderedTick = ref(0);
const latestIntentGroups = ref([]);
const toasts = ref([]);
const showToastInUi = runtimeModeConfig.isDevelopment;
const isPreviewVisible = ref(runtimeModeConfig.isDevelopment);
const previewPlaceholderText = ref(runtimeModeConfig.isDevelopment ? "" : "No chart entered");
let toastSeed = 0;
let panelGroupSeed = 0;

const htmlContent = computed(() => buildChartHtml(parts.value));

function handleChartRendered() {
  chartRenderedTick.value += 1;
}

function handleFocusIntentGroup(payload) {
  const groupId = String(payload?.groupId || "").trim();
  if (!groupId) {
    return;
  }
  const focusFn = controlPanelRef.value?.focusGroupById;
  if (typeof focusFn === "function") {
    focusFn(groupId);
  }
}

function pushToast(message, type = "info", timeoutMs = 2800) {
  if (!showToastInUi) {
    return;
  }
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

function buildFallbackDecomposeItemFromIntent(intent, index) {
  const parameters = intent?.parameters && typeof intent.parameters === "object" ? intent.parameters : {};
  const intentText =
    String(parameters.decomposeIntent || "").trim() ||
    String(intent?.task || "").trim() ||
    `Intent ${index + 1}`;
  const targetText =
    String(parameters.decomposeTarget || "").trim() ||
    (Array.isArray(intent?.target) ? intent.target.join(", ") : "");
  return {
    intent: intentText,
    target: targetText,
    attributes: Array.isArray(parameters.attributes) ? parameters.attributes : [],
    affected: Array.isArray(parameters.affected) ? parameters.affected : [],
  };
}

function ensureDecomposeIntentItems(rawDecomposeJson, intents) {
  const normalizedIntents = ensureIntentArray(intents);
  const candidates = [];

  if (Array.isArray(rawDecomposeJson)) {
    rawDecomposeJson.forEach((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        candidates.push(item);
      }
    });
  } else if (rawDecomposeJson && typeof rawDecomposeJson === "object") {
    if (Array.isArray(rawDecomposeJson.intents)) {
      rawDecomposeJson.intents.forEach((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          candidates.push(item);
        }
      });
    } else {
      candidates.push(rawDecomposeJson);
    }
  }

  const expectedCount = normalizedIntents.length || candidates.length || 1;
  const result = [];
  for (let index = 0; index < expectedCount; index += 1) {
    const candidate = candidates[index];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      result.push(candidate);
      continue;
    }
    result.push(buildFallbackDecomposeItemFromIntent(normalizedIntents[index], index));
  }
  return result;
}

function buildPanelGroupLabel({ intent, recommendationJson, panelJson, index }) {
  const fromPanel = String(panelJson?.label || "").trim();
  if (fromPanel) {
    return fromPanel;
  }
  const fromTarget = String(recommendationJson?.structure?.target || "").trim();
  if (fromTarget) {
    return fromTarget;
  }
  const fromIntent = String(recommendationJson?.intent || "").trim();
  if (fromIntent) {
    return fromIntent;
  }
  const fromTask = String(intent?.task || "").trim();
  if (fromTask) {
    return fromTask;
  }
  return `Intent ${index + 1}`;
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

  const decomposeIntentItems = ensureDecomposeIntentItems(intentDecomposeJson, intents);
  const recommendationResults = await Promise.all(
    decomposeIntentItems.map((item, index) =>
      parseRecommendationWithLLM({
        intentDecomposeJson: item,
        imageBase64,
      }).catch((error) => {
        throw new Error(`Recommendation failed for intent ${index + 1}: ${error?.message || "unknown error"}`);
      })
    )
  );

  return {
    intents,
    intentDecomposeJson,
    decomposeIntentItems,
    recommendationResults,
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

async function resolvePreviewMaxSize() {
  await nextTick();
  const getSizeFn = chartPreviewRef.value?.getPreviewMaxSize;
  if (typeof getSizeFn !== "function") {
    return null;
  }
  return getSizeFn();
}

async function resolveImageBase64(userImageBase64) {
  let imageBase64 =
    typeof userImageBase64 === "string" && userImageBase64.trim() ? userImageBase64.trim() : null;

  if (!imageBase64) {
    try {
      imageBase64 = await captureCurrentChartImage();
    } catch {
      imageBase64 = null;
    }
  }
  return imageBase64;
}

async function runFeasibilityPrecheckAndMaybePatch({
  prompt,
  sourceData,
  renderScript,
  imageBase64,
  baseParts,
}) {
  const precheckResult = await parseIntentFeasibilityPrecheckWithLLM({
    prompt,
    sourceData,
    imageBase64,
  });

  const precheckJson =
    precheckResult?.precheckJson &&
    typeof precheckResult.precheckJson === "object" &&
    !Array.isArray(precheckResult.precheckJson)
      ? precheckResult.precheckJson
      : { intents: [], all_data_only: true };

  const precheckIntents = Array.isArray(precheckJson.intents) ? precheckJson.intents : [];
  const renderRequiredIntents = precheckIntents.filter((item) => item?.needs_render_update === true);

  pushToast(
    precheckJson.all_data_only === true
      ? "Feasibility precheck: all intents are data-only."
      : `Feasibility precheck: ${renderRequiredIntents.length} intent(s) require render incremental update.`,
    "info"
  );

  if (precheckJson.all_data_only === true || !renderRequiredIntents.length) {
    return {
      parts: baseParts,
      precheckJson,
      incrementalJson: null,
      incrementalSummary: null,
    };
  }

  const incrementalResult = await parseRenderIncrementalUpdateWithLLM({
    renderRequiredIntents,
    sourceData,
    renderScript,
    imageBase64,
  });

  const applied = applyIncrementalRenderUpdate(baseParts, incrementalResult?.incrementalJson || {});
  const summary = applied?.summary || {};
  pushToast(
    `Incremental render update applied (source +${summary.source_add_applied || 0}, render inserts ${
      summary.render_insert_applied || 0
    }).`,
    "success"
  );

  return {
    parts: applied.parts,
    precheckJson,
    incrementalJson: incrementalResult?.incrementalJson || null,
    incrementalSummary: summary,
  };
}

async function resolveIntent({ prompt, userImageBase64 = null, sourceDataOverride = null }) {
  const sourceData =
    sourceDataOverride && typeof sourceDataOverride === "object"
      ? safeDeepClone(sourceDataOverride, {})
      : safeDeepClone(parts.value?.source_data, {});
  let imageBase64 = await resolveImageBase64(userImageBase64);

  try {
    const result = await runIntentAndRecommendation({
      prompt,
      sourceData,
      imageBase64,
    });
    const intents = result.intents;
    const countText =
      intents.length === 0 ? "0 intent" : intents.length > 1 ? `${intents.length} intents` : "1 intent";
    pushToast(
      imageBase64
        ? `LLM parser succeeded with visual input (${countText}).`
        : `LLM parser succeeded (text-only, ${countText}).`,
      "info"
    );

    const recommendationResults = Array.isArray(result.recommendationResults)
      ? result.recommendationResults
      : [];
    const recommendationRequiredCount = recommendationResults.filter(
      (item) => item?.recommendationJson?.recommendationRequired === true
    ).length;
    pushToast(
      recommendationRequiredCount > 0
        ? `Recommendation model succeeded (${recommendationRequiredCount}/${recommendationResults.length} intents require presets).`
        : `Recommendation model succeeded (${recommendationResults.length} intents).`,
      "success"
    );
    return result;
  } catch (visionError) {
    if (imageBase64) {
      try {
        const result = await runIntentAndRecommendation({
          prompt,
          sourceData,
          imageBase64: null,
        });
        pushToast("Visual parse failed, text-only LLM succeeded (intent + recommendation).", "warning");

        const recommendationResults = Array.isArray(result.recommendationResults)
          ? result.recommendationResults
          : [];
        const recommendationRequiredCount = recommendationResults.filter(
          (item) => item?.recommendationJson?.recommendationRequired === true
        ).length;
        pushToast(
          recommendationRequiredCount > 0
            ? `Recommendation model succeeded (${recommendationRequiredCount}/${recommendationResults.length} intents require presets).`
            : `Recommendation model succeeded (${recommendationResults.length} intents).`,
          "success"
        );
        return result;
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
  latestIntentGroups.value = [];

  try {
    const resolvedImageBase64 = await resolveImageBase64(userImageBase64);

    let workingParts = safeDeepClone(parts.value, createEmptyChartParts());
    const precheckState = await runFeasibilityPrecheckAndMaybePatch({
      prompt,
      sourceData: safeDeepClone(workingParts?.source_data, {}),
      renderScript: workingParts?.html_template?.render_script || "",
      imageBase64: resolvedImageBase64,
      baseParts: workingParts,
    });
    workingParts = precheckState.parts;

    const llmResult = await resolveIntent({
      prompt,
      userImageBase64: resolvedImageBase64,
      sourceDataOverride: workingParts?.source_data || {},
    });
    const intents = ensureIntentArray(llmResult?.intents);
    const recommendationResults = Array.isArray(llmResult?.recommendationResults)
      ? llmResult.recommendationResults
      : [];

    let nextParts = workingParts;
    let nextPanelSpec = panelSpec.value;
    const previousPanelGroups = safeDeepClone(panelGroups.value, []);
    const appendedPanelGroups = [];

    if (!intents.length) {
      pushToast("No intent recognized.", "warning");
    } else {
      intents.forEach((intent) => {
        const updatePlan = intentToUpdatePlan(intent, nextParts, nextPanelSpec);
        const sourceOnlyPlan = {
          sourceDataUpdates: updatePlan?.sourceDataUpdates || [],
          panelUpdates: [],
        };
        const nextState = applyUpdatePlan(nextParts, nextPanelSpec, sourceOnlyPlan);
        nextParts = nextState.parts;
        nextPanelSpec = nextState.panelSpec;
      });
    }

    recommendationResults.forEach((result, index) => {
      const recommendationPanelPlan = buildRecommendationPanelPlan({
        recommendationJson: result?.recommendationJson || {},
        panelJson: result?.panelJson || {},
        chartParts: nextParts,
      });

      const groupBaseSpec = createEmptyPanelSpec();
      const groupState = applyUpdatePlan(nextParts, groupBaseSpec, recommendationPanelPlan);
      nextParts = groupState.parts;

      const groupLabel = buildPanelGroupLabel({
        intent: intents[index],
        recommendationJson: result?.recommendationJson || {},
        panelJson: result?.panelJson || {},
        index,
      });

      appendedPanelGroups.push({
        id: `intent_group_${Date.now()}_${panelGroupSeed++}`,
        label: groupLabel,
        panelSpec: groupState.panelSpec,
      });
    });

    const mergedPanelGroups = previousPanelGroups.concat(appendedPanelGroups);

    if (!mergedPanelGroups.length) {
      nextPanelSpec = createEmptyPanelSpec();
    } else if (!previousPanelGroups.length) {
      nextPanelSpec = safeDeepClone(mergedPanelGroups[0].panelSpec, createEmptyPanelSpec());
    }

    if (appendedPanelGroups.length) {
      pushToast(
        `Added ${appendedPanelGroups.length} panel groups (total ${mergedPanelGroups.length}).`,
        "info"
      );
    }

    parts.value = nextParts;
    panelSpec.value = nextPanelSpec;
    panelGroups.value = mergedPanelGroups;
    latestIntentGroups.value = appendedPanelGroups.map((group) => ({
      groupId: group.id,
      label: group.label,
    }));

    if (intents.length) {
      const intentSummary = intents.map((intent) => `${intent.task} (${intent.action})`).join(" + ");
      pushToast(`Intents: ${intentSummary}`, "success");
    }
  } catch (error) {
    latestIntentGroups.value = [];
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
    panelGroups.value = [];
    latestIntentGroups.value = [];
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
    const previewMaxSize = await resolvePreviewMaxSize();
    const htmlText = await generateChartHtmlFromImage({ imageBase64, previewMaxSize });
    const generatedParts = await htmlToChartParts(htmlText);
    parts.value = generatedParts;
    panelSpec.value = createEmptyPanelSpec();
    panelGroups.value = [];
    latestIntentGroups.value = [];
    generated = true;
    pushToast("Chart template generated from uploaded image.", "success");
  } catch (error) {
    latestIntentGroups.value = [];
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

    <div v-if="showToastInUi" class="toast-layer" aria-live="polite">
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
          :chart-rendered-tick="chartRenderedTick"
          :is-chart-visible="isPreviewVisible"
          :latest-intent-groups="latestIntentGroups"
          @submit-prompt="handlePromptSubmit"
          @image-uploaded="handleImageUploaded"
          @focus-intent-group="handleFocusIntentGroup"
        />
      </div>

      <div class="center-column">
        <ChartPreview
          ref="chartPreviewRef"
          :html-content="htmlContent"
          :is-chart-visible="isPreviewVisible"
          :placeholder-text="previewPlaceholderText"
          @chart-rendered="handleChartRendered"
        />
      </div>

      <div class="right-column">
        <ControlPanel
          ref="controlPanelRef"
          :parts="parts"
          :panel-spec="panelSpec"
          :panel-groups="panelGroups"
        />
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
