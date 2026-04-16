<script setup>
const props = defineProps({
  sourceData: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:source-data"]);

function updateField(field, value) {
  emit("update:source-data", {
    ...props.sourceData,
    [field]: value,
  });
}

function onNumberInput(field, rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isNaN(parsed)) {
    updateField(field, parsed);
  }
}
</script>

<template>
  <section class="control-panel panel">
    <header class="panel-header">
      <h2>Control Panel</h2>
      <p>Static panel with room for future schema expansion</p>
    </header>

    <div class="form-grid">
      <label>
        <span>Chart Width</span>
        <input
          type="number"
          min="300"
          max="1200"
          step="10"
          :value="sourceData.chartWidth"
          @input="onNumberInput('chartWidth', $event.target.value)"
        />
      </label>

      <label>
        <span>Chart Height</span>
        <input
          type="number"
          min="240"
          max="900"
          step="10"
          :value="sourceData.chartHeight"
          @input="onNumberInput('chartHeight', $event.target.value)"
        />
      </label>

      <label>
        <span>Bar Color</span>
        <input type="color" :value="sourceData.barColor" @input="updateField('barColor', $event.target.value)" />
      </label>

      <label>
        <span>Bar Gap (0-0.9)</span>
        <input
          type="range"
          min="0"
          max="0.9"
          step="0.05"
          :value="sourceData.barGap"
          @input="onNumberInput('barGap', $event.target.value)"
        />
        <small>{{ sourceData.barGap.toFixed(2) }}</small>
      </label>

      <label>
        <span>Title Font Size</span>
        <input
          type="number"
          min="12"
          max="48"
          step="1"
          :value="sourceData.titleFontSize"
          @input="onNumberInput('titleFontSize', $event.target.value)"
        />
      </label>

      <label>
        <span>Title Text</span>
        <input
          type="text"
          :value="sourceData.titleText"
          @input="updateField('titleText', $event.target.value)"
          placeholder="Input chart title"
        />
      </label>
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
  overflow: auto;
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 14px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

span {
  font-size: 13px;
  color: #374151;
}

input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
}

input[type="color"] {
  padding: 4px;
  height: 38px;
}

input[type="range"] {
  padding: 0;
}

small {
  color: #6b7280;
}
</style>
