<script setup>
import { computed, reactive } from "vue";
import CodePanel from "./components/CodePanel.vue";
import ChartPreview from "./components/ChartPreview.vue";
import ControlPanel from "./components/ControlPanel.vue";
import { createSampleChartParts, sourceDataToCode } from "./data/sampleChartParts";
import { buildChartHtml } from "./utils/buildChartHtml";

const parts = reactive(createSampleChartParts());

const sourceDataCode = computed(() => sourceDataToCode(parts.source_data));
const htmlContent = computed(() => buildChartHtml(parts));

function updateSourceData(nextSourceData) {
  parts.source_data = nextSourceData;
}
</script>

<template>
  <main class="workbench">
    <header class="workbench-header">
      <h1>Chart Editing Workbench</h1>
      <p>Structured code view + source_data controls + live preview</p>
    </header>

    <section class="workbench-grid">
      <div class="left-column">
        <CodePanel :source-data-code="sourceDataCode" :render-code="parts.render_code" />
      </div>

      <div class="center-column">
        <ChartPreview :html-content="htmlContent" />
      </div>

      <div class="right-column">
        <ControlPanel :source-data="parts.source_data" @update:source-data="updateSourceData" />
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
  margin-bottom: 12px;
}

.workbench-header h1 {
  margin: 0;
  font-size: 20px;
}

.workbench-header p {
  margin: 4px 0 0;
  color: #d1d5db;
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
  .workbench-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, minmax(0, 1fr));
  }

  .left-column,
  .center-column,
  .right-column {
    min-height: 0;
  }
}
</style>
