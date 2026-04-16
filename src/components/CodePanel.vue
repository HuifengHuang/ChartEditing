<script setup>
defineProps({
  sourceDataCode: {
    type: String,
    required: true,
  },
  renderCode: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <section class="code-panel panel">
    <header class="panel-header">
      <h2>Code Panel</h2>
      <p>Structured code display (read-only)</p>
    </header>

    <div class="code-sections">
      <div class="code-block">
        <h3>Source Data</h3>
        <pre><code>{{ sourceDataCode }}</code></pre>
      </div>

      <div class="code-block">
        <h3>Render Code</h3>
        <pre><code>{{ renderCode }}</code></pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  height: 100%;
  overflow: hidden;
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

.code-sections {
  margin-top: 14px;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.code-block {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.code-block h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

pre {
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #111827;
  color: #e5e7eb;
  padding: 10px;
  font-family: "Cascadia Code", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
