<script setup>
import { onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  busy: {
    type: Boolean,
    default: false,
  },
  llmResponseTick: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["submit-prompt"]);

const chartHtmlInput = ref("");
const chatInput = ref("");
const messages = ref([]);
const messageSeed = ref(0);
const waitingFinalReply = ref(false);
const introReplyShown = ref(false);
const llmCompletedForTurn = ref(false);
let introReplyTimerId = null;

function pushMessage(role, content) {
  messages.value.push({
    id: `msg_${Date.now()}_${messageSeed.value++}`,
    role,
    content,
  });
}

function maybeSendFinalReply() {
  if (!waitingFinalReply.value) {
    return;
  }
  if (!introReplyShown.value || !llmCompletedForTurn.value) {
    return;
  }

  pushMessage("assistant", "The code and UI panel have been updated for you.");
  waitingFinalReply.value = false;
}

watch(
  () => props.llmResponseTick,
  (nextValue, prevValue) => {
    if (Number(nextValue) <= Number(prevValue ?? 0)) {
      return;
    }
    llmCompletedForTurn.value = true;
    maybeSendFinalReply();
  }
);

function submitPrompt() {
  const value = chatInput.value.trim();
  if (!value || props.busy) {
    return;
  }

  if (introReplyTimerId) {
    clearTimeout(introReplyTimerId);
    introReplyTimerId = null;
  }

  pushMessage("user", value);
  waitingFinalReply.value = true;
  introReplyShown.value = false;
  llmCompletedForTurn.value = false;

  introReplyTimerId = setTimeout(() => {
    introReplyShown.value = true;
    pushMessage("assistant", "Okay, processing your request.");
    maybeSendFinalReply();
    introReplyTimerId = null;
  }, 1000);

  emit("submit-prompt", value);
  chatInput.value = "";
}

onBeforeUnmount(() => {
  if (introReplyTimerId) {
    clearTimeout(introReplyTimerId);
    introReplyTimerId = null;
  }
});
</script>

<template>
  <section class="code-panel panel">
    <header class="panel-header">
      <h2>User Input</h2>
    </header>

    <div class="panel-sections">
      <section class="panel-section">
        <header class="section-title-row">
          <h3>Chart Input (.html)</h3>
          <input type="file" accept=".html,text/html" />
        </header>
        <textarea
          v-model="chartHtmlInput"
          spellcheck="false"
          placeholder="Paste your chart html content here (.html)."
        />
      </section>

      <section class="panel-section">
        <header class="section-title-row">
          <h3>LLM Chat</h3>
        </header>

        <div class="chat-log">
          <div v-for="message in messages" :key="message.id" class="chat-item" :class="message.role">
            <div class="chat-role">{{ message.role === "user" ? "You" : "Model" }}</div>
            <div class="chat-content">{{ message.content }}</div>
          </div>
        </div>

        <div class="chat-input-row">
          <input
            v-model="chatInput"
            type="text"
            :disabled="busy"
            placeholder="Talk to the model..."
            @keydown.enter.prevent="submitPrompt"
          />
          <button type="button" :disabled="busy" @click="submitPrompt">
            {{ busy ? "Running..." : "Send" }}
          </button>
        </div>
      </section>
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

.panel-sections {
  margin-top: 14px;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.panel-section {
  min-height: 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.section-title-row h3 {
  margin: 0;
  font-size: 14px;
}

textarea {
  flex: 1;
  min-height: 0;
  resize: none;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  font-family: "Cascadia Code", "Consolas", monospace;
  line-height: 1.5;
  background: #f8fafc;
}

.chat-log {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-item {
  border-radius: 8px;
  padding: 7px 8px;
}

.chat-item.user {
  background: #dbeafe;
}

.chat-item.assistant {
  background: #ecfeff;
}

.chat-role {
  font-size: 11px;
  color: #475569;
  margin-bottom: 4px;
}

.chat-content {
  font-size: 12px;
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.chat-input-row input {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.chat-input-row button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}

.chat-input-row button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
