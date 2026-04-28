<script setup>
import { ref } from "vue";

const emit = defineEmits(["chart-rendered"]);

const props = defineProps({
  htmlContent: {
    type: String,
    required: true,
  },
  isChartVisible: {
    type: Boolean,
    default: true,
  },
  placeholderText: {
    type: String,
    default: "No chart entered",
  },
});

const iframeRef = ref(null);
const viewportRef = ref(null);

function onFrameLoad() {
  emit("chart-rendered");
}

// 导出当前预览中的完整 HTML 文件，便于离线查看与复现。
function exportChartHtml() {
  const html = String(props.htmlContent || "").trim();
  if (!html) {
    return;
  }

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  anchor.href = url;
  anchor.download = `chart-export-${stamp}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// 等待 iframe 文档加载完成，避免读取内容时机过早。
function waitForFrameLoad(frame, timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!frame) {
      resolve(false);
      return;
    }

    const doc = frame.contentDocument;
    if (doc?.readyState === "complete" || doc?.readyState === "interactive") {
      resolve(true);
      return;
    }

    const timer = setTimeout(() => {
      frame.removeEventListener("load", onLoad);
      resolve(false);
    }, timeoutMs);

    function onLoad() {
      clearTimeout(timer);
      resolve(true);
    }

    frame.addEventListener("load", onLoad, { once: true });
  });
}

// 将 SVG 转为 PNG base64，用于发送给视觉模型。
function svgToPngBase64(svgElement) {
  return new Promise((resolve, reject) => {
    const clone = svgElement.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    const svgMarkup = new XMLSerializer().serializeToString(clone);

    const width = Math.max(
      1,
      Math.round(
        Number(svgElement.getAttribute("width")) || svgElement.clientWidth || 420
      )
    );
    const height = Math.max(
      1,
      Math.round(
        Number(svgElement.getAttribute("height")) || svgElement.clientHeight || 520
      )
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Failed to create canvas context"));
      return;
    }
    // 补一层白底，避免透明背景导出后在部分模型中识别不稳定。
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
      resolve(base64);
    };
    img.onerror = () => reject(new Error("Failed to decode SVG image"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });
}

// 对外暴露：抓取当前图表快照（base64）。
async function captureChartImageBase64() {
  const frame = iframeRef.value;
  if (!frame) {
    throw new Error("Chart iframe is not ready");
  }

  await waitForFrameLoad(frame);
  const doc = frame.contentDocument;
  const svg = doc?.querySelector("#chart, svg");
  if (!svg) {
    throw new Error("Chart SVG not found in iframe");
  }

  return svgToPngBase64(svg);
}

// 获取 Chart Preview 可用渲染区域尺寸，用于指导模型设置画布大小。
function getPreviewMaxSize() {
  const viewportEl = viewportRef.value;
  if (!viewportEl) {
    return null;
  }

  const style = window.getComputedStyle(viewportEl);
  const paddingX =
    (Number.parseFloat(style.paddingLeft || "0") || 0) +
    (Number.parseFloat(style.paddingRight || "0") || 0);
  const paddingY =
    (Number.parseFloat(style.paddingTop || "0") || 0) +
    (Number.parseFloat(style.paddingBottom || "0") || 0);

  // iframe 默认有 1px 边框，另外再预留少量安全留白，避免图形贴边或被裁切。
  const iframeBorderX = 2;
  const iframeBorderY = 2;
  const safeInsetX = 24;
  const safeInsetY = 24;

  const usableWidth = viewportEl.clientWidth - paddingX - iframeBorderX - safeInsetX;
  const usableHeight = viewportEl.clientHeight - paddingY - iframeBorderY - safeInsetY;
  const maxWidth = Math.max(1, Math.floor(usableWidth));
  const maxHeight = Math.max(1, Math.floor(usableHeight));
  return {
    maxWidth,
    maxHeight,
  };
}

defineExpose({
  captureChartImageBase64,
  getPreviewMaxSize,
});
</script>

<template>
  <section class="preview-panel panel">
    <header class="panel-header">
      <h2>Chart Preview</h2>
      <button type="button" class="export-btn" @click="exportChartHtml">
        Export HTML
      </button>
    </header>
    <div class="title-divider" aria-hidden="true"></div>
    <div ref="viewportRef" class="preview-viewport">
      <div v-if="!isChartVisible" class="preview-rebuild-placeholder">
        {{ placeholderText }}
      </div>
      <iframe
        v-else
        ref="iframeRef"
        :srcdoc="htmlContent"
        sandbox="allow-scripts allow-same-origin"
        title="chart-preview"
        @load="onFrameLoad"
      ></iframe>
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
  display: flex;
  flex-direction: column;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.title-divider {
  margin-top: 8px;
  width: 100%;
  height: 1px;
  border-radius: 999px;
  background: #d8e0ea;
}

.export-btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.export-btn:hover {
  background: #f8fafc;
}

iframe {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
}

.preview-viewport {
  margin-top: 10px;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
}

.preview-rebuild-placeholder {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  display: grid;
  place-items: center;
  color: #475569;
  font-size: 13px;
}
</style>
