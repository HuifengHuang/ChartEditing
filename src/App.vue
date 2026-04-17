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
import { parseIntent } from "./utils/parseIntent";
import { intentToUpdatePlan } from "./utils/intentToUpdatePlan";
import { applyUpdatePlan } from "./utils/applyUpdatePlan";

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

const sourceDataCode = computed(() => sourceDataMirroredMoodToCode(parts.value.source_data));
const htmlContent = computed(() => buildChartHtml(parts.value));

function handlePromptSubmit(prompt) {
  const intent = parseIntent(prompt);
  const updatePlan = intentToUpdatePlan(intent, parts.value, panelSpec.value);
  const nextState = applyUpdatePlan(parts.value, panelSpec.value, updatePlan);
  parts.value = nextState.parts;
  panelSpec.value = nextState.panelSpec;
  lastIntent.value = intent;
}
</script>

<template>
  <main class="workbench">
    <header class="workbench-header">
      <h1>Chart Editing Workbench</h1>
      <p>Prompt -> Intent -> UpdatePlan -> source_data/panelSpec -> live preview</p>
    </header>

    <PromptBar @submit-prompt="handlePromptSubmit" />
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
