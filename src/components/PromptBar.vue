<script setup>
import { ref } from "vue";

const emit = defineEmits(["submit-prompt"]);

const prompt = ref("");

const samplePrompts = [
  "把比例改成 1:1.2",
  "给我几个更柔和的颜色风格",
  "加一个 2024-01 的数据点",
  "图例横着排",
];

function submit() {
  const value = prompt.value.trim();
  if (!value) {
    return;
  }
  emit("submit-prompt", value);
}

function useSample(value) {
  prompt.value = value;
  submit();
}
</script>

<template>
  <section class="prompt-bar">
    <div class="prompt-main">
      <input
        v-model="prompt"
        type="text"
        placeholder="Type an editing intent, e.g. 把比例改成1:1.2 / 图例横着排"
        @keydown.enter.prevent="submit"
      />
      <button type="button" @click="submit">Run</button>
    </div>
    <div class="prompt-samples">
      <button v-for="item in samplePrompts" :key="item" type="button" @click="useSample(item)">
        {{ item }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.prompt-bar {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 10px;
}

.prompt-main {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

input {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 9px 10px;
  font-size: 14px;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}

.prompt-samples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.prompt-samples button {
  font-size: 12px;
  padding: 5px 9px;
}
</style>
