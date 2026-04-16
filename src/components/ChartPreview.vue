<script setup>
defineProps({
  htmlContent: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <section class="preview-panel panel">
    <header class="panel-header">
      <h2>Chart Preview</h2>
      <p>iframe + srcdoc live rendering</p>
    </header>
    <iframe :srcdoc="htmlContent" sandbox="allow-scripts allow-same-origin" title="chart-preview"></iframe>
  </section>
</template>

<style scoped>
.panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
}

.panel-header p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

iframe {
  margin-top: 12px;
  width: 100%;
  flex: 1;
  min-height: 0;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
}
</style>
