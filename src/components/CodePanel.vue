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

const emit = defineEmits(["submit-prompt", "image-uploaded"]);
const REBUILD_DELAY_MS = 20_000;

const chatInput = ref("");
const imageFileInputRef = ref(null);
const uploadedImageDataUrl = ref("");
const uploadedImageBase64 = ref("");
const uploadedImageName = ref("");
const imageUploadError = ref("");
const messages = ref([]);
const messageSeed = ref(0);
const waitingFinalReply = ref(false);
const introReplyShown = ref(false);
const llmCompletedForTurn = ref(false);
let introReplyTimerId = null;
let rebuildStatusTimerId = null;
let rebuildStatusMessageId = null;

function pushMessage(role, content) {
  const message = {
    id: `msg_${Date.now()}_${messageSeed.value++}`,
    role,
    content,
    loading: false,
  };
  messages.value.push(message);
  return message.id;
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

  const userMessage = uploadedImageName.value ? `${value}\n[Attached image: ${uploadedImageName.value}]` : value;
  pushMessage("user", userMessage);
  waitingFinalReply.value = true;
  introReplyShown.value = false;
  llmCompletedForTurn.value = false;

  introReplyTimerId = setTimeout(() => {
    introReplyShown.value = true;
    pushMessage("assistant", "Okay, processing your request.");
    maybeSendFinalReply();
    introReplyTimerId = null;
  }, 1000);

  emit("submit-prompt", {
    prompt: value,
    imageBase64: uploadedImageBase64.value || null,
    imageName: uploadedImageName.value || null,
  });
  chatInput.value = "";
}

function clearUploadedImage() {
  uploadedImageDataUrl.value = "";
  uploadedImageBase64.value = "";
  uploadedImageName.value = "";
  imageUploadError.value = "";
  if (imageFileInputRef.value) {
    imageFileInputRef.value.value = "";
  }
}

function updateMessageById(messageId, updater) {
  const index = messages.value.findIndex((item) => item.id === messageId);
  if (index < 0) {
    return;
  }
  const next = { ...messages.value[index] };
  updater(next);
  messages.value[index] = next;
}

function showRebuildStatusMessage() {
  if (rebuildStatusTimerId) {
    clearTimeout(rebuildStatusTimerId);
    rebuildStatusTimerId = null;
  }

  if (!rebuildStatusMessageId) {
    rebuildStatusMessageId = pushMessage("assistant", "Rebuilding the chart...");
  }

  updateMessageById(rebuildStatusMessageId, (message) => {
    message.content = "Rebuilding the chart...";
    message.loading = true;
  });

  rebuildStatusTimerId = setTimeout(() => {
    updateMessageById(rebuildStatusMessageId, (message) => {
      message.loading = false;
      message.content = "The chart has been rebuilt for you.";
    });
    rebuildStatusTimerId = null;
    rebuildStatusMessageId = null;
  }, REBUILD_DELAY_MS);
}

function triggerImagePicker() {
  if (props.busy || !imageFileInputRef.value) {
    return;
  }
  imageFileInputRef.value.value = "";
  imageFileInputRef.value.click();
}

function onImageSelected(event) {
  const file = event?.target?.files?.[0];
  if (!file) {
    return;
  }

  imageUploadError.value = "";
  if (!String(file.type || "").startsWith("image/")) {
    clearUploadedImage();
    imageUploadError.value = "Please upload an image file.";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    const base64 = dataUrl.split(",")[1] || "";

    if (!base64) {
      clearUploadedImage();
      imageUploadError.value = "Failed to read image data.";
      return;
    }

    uploadedImageDataUrl.value = dataUrl;
    uploadedImageBase64.value = base64;
    uploadedImageName.value = file.name || "uploaded-image";
    emit("image-uploaded", {
      imageBase64: uploadedImageBase64.value,
      imageName: uploadedImageName.value,
    });
    showRebuildStatusMessage();
  };
  reader.onerror = () => {
    clearUploadedImage();
    imageUploadError.value = "Failed to read image data.";
  };
  reader.readAsDataURL(file);
}

onBeforeUnmount(() => {
  if (introReplyTimerId) {
    clearTimeout(introReplyTimerId);
    introReplyTimerId = null;
  }
  if (rebuildStatusTimerId) {
    clearTimeout(rebuildStatusTimerId);
    rebuildStatusTimerId = null;
  }
  rebuildStatusMessageId = null;
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
          <h3>Chart Input</h3>
        </header>

        <div class="chart-input-wrap">
          <div class="image-upload-row">
            <input
              ref="imageFileInputRef"
              class="image-file-input"
              type="file"
              accept="image/*"
              :disabled="busy"
              @change="onImageSelected"
            />
            <button type="button" class="upload-btn" :disabled="busy" @click="triggerImagePicker">
              {{ uploadedImageDataUrl ? "Re-upload" : "Choose File" }}
            </button>
          </div>

          <div v-if="uploadedImageName" class="image-name">{{ uploadedImageName }}</div>
          <div v-if="imageUploadError" class="image-error">{{ imageUploadError }}</div>

          <div v-if="!uploadedImageDataUrl" class="image-empty">
            No image uploaded yet.
          </div>
          <img
            v-else
            class="image-preview"
            :src="uploadedImageDataUrl"
            alt="Chart input preview"
          />
        </div>
      </section>

      <section class="panel-section">
        <header class="section-title-row">
          <h3>LLM Chat</h3>
        </header>

        <div class="chat-log">
          <div v-for="message in messages" :key="message.id" class="chat-item" :class="message.role">
            <div class="chat-role">{{ message.role === "user" ? "You" : "Model" }}</div>
            <div class="chat-content">
              {{ message.content }}
              <span v-if="message.loading" class="loading-dots" aria-hidden="true">
                <span></span><span></span><span></span>
              </span>
            </div>
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

.chart-input-wrap {
  flex: 1;
  min-height: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.image-upload-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.image-file-input {
  display: none;
}

.upload-btn {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.image-name {
  font-size: 12px;
  color: #475569;
}

.image-error {
  font-size: 12px;
  color: #b91c1c;
}

.image-empty {
  flex: 1;
  min-height: 0;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 12px;
}

.image-preview {
  flex: 1;
  min-height: 0;
  width: 100%;
  object-fit: contain;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
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

.loading-dots {
  display: inline-flex;
  margin-left: 6px;
  gap: 2px;
  align-items: center;
}

.loading-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #475569;
  opacity: 0.25;
  animation: dot-blink 1.2s infinite ease-in-out;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dot-blink {
  0%,
  80%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-1px);
  }
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
