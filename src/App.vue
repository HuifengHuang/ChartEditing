<script setup>
import { computed, ref } from "vue";
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

const lastIntent = ref(null);
const busy = ref(false);
const notice = ref("");
const errorMessage = ref("");

const sourceDataCode = computed(() => sourceDataMirroredMoodToCode(parts.value.source_data));
const htmlContent = computed(() => buildChartHtml(parts.value));

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
      "add_element",
      "remove_element",
      "legend_edit",
      "expand_controls",
    ],
    panelSummary: {
      sectionCount: sections.length,
      sections: sectionSummary,
      expandedSections: panelSpec.value?.uiState?.expandedSections || [],
      highlightedSectionId: panelSpec.value?.uiState?.highlightedSectionId || null,
    },
  };
}

async function resolveIntent(prompt) {
  try {
    const intent = await parseIntentWithLLM({
      prompt,
      context: buildIntentContext(),
    });
    notice.value = "LLM parser succeeded.";
    return intent;
  } catch (error) {
    notice.value = "LLM failed, fallback to rule parser.";
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
  notice.value = "";
  errorMessage.value = "";

  try {
    const intent = await resolveIntent(prompt);
    const updatePlan = intentToUpdatePlan(intent, parts.value, panelSpec.value);
    const nextState = applyUpdatePlan(parts.value, panelSpec.value, updatePlan);
    parts.value = nextState.parts;
    panelSpec.value = nextState.panelSpec;
    lastIntent.value = intent;
  } catch (error) {
    errorMessage.value = error?.message || "Intent parsing failed.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="workbench">
    <header class="workbench-header">
      <h1>Chart Editing Workbench</h1>
      <p>Prompt -> Intent -> UpdatePlan -> source_data/panelSpec -> live preview</p>
    </header>

    <PromptBar
      :busy="busy"
      @submit-prompt="handlePromptSubmit"
    />

    <div v-if="notice" class="notice notice-info">{{ notice }}</div>
    <div v-if="errorMessage" class="notice notice-error">{{ errorMessage }}</div>

    <div v-if="lastIntent" class="intent-status">
      Last Intent: <strong>{{ lastIntent.task }}</strong>
      <span>({{ lastIntent.action }})</span>
    </div>

    <section class="workbench-grid">
      <div class="left-column">
        <CodePanel :source-data-code="sourceDataCode" :render-code="parts.render_code" />
      </div>

      <div class="center-column">
        <ChartPreview :html-content="htmlContent" />
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

.notice {
  margin: 0 0 8px;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.notice-info {
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1e3a8a;
}

.notice-error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

.intent-status {
  margin: 0 0 8px;
  padding: 6px 10px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  border-radius: 10px;
  font-size: 12px;
  color: #1e3a8a;
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
