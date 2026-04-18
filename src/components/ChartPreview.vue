<script setup>
import { ref } from "vue";

defineProps({
  htmlContent: {
    type: String,
    required: true,
  },
});

const iframeRef = ref(null);

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

defineExpose({
  captureChartImageBase64,
});
</script>

<template>
  <section class="preview-panel panel">
    <header class="panel-header">
      <h2>Chart Preview</h2>
      <p>iframe + srcdoc live rendering</p>
    </header>
    <iframe
      ref="iframeRef"
      :srcdoc="htmlContent"
      sandbox="allow-scripts allow-same-origin"
      title="chart-preview"
    ></iframe>
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
