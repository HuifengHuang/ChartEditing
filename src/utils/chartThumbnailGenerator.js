function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForFrameLoad(frame, timeoutMs = 2500) {
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

function svgToDataUrl(svgElement) {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  const markup = new XMLSerializer().serializeToString(clone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode thumbnail image"));
    image.src = url;
  });
}

function drawContain(ctx, image, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
  const drawWidth = Math.max(1, Math.round(image.width * scale));
  const drawHeight = Math.max(1, Math.round(image.height * scale));
  const offsetX = Math.floor((targetWidth - drawWidth) / 2);
  const offsetY = Math.floor((targetHeight - drawHeight) / 2);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export async function generateChartThumbnailFromHtml(
  htmlText,
  {
    mountWidth = 800,
    mountHeight = 520,
    targetWidth = 120,
    targetHeight = 80,
    renderWaitMs = 180,
  } = {}
) {
  const html = String(htmlText || "").trim();
  if (!html) {
    return "";
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.style.position = "fixed";
  frame.style.left = "-99999px";
  frame.style.top = "0";
  frame.style.width = `${Math.max(320, Math.floor(mountWidth))}px`;
  frame.style.height = `${Math.max(240, Math.floor(mountHeight))}px`;
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.style.border = "0";
  document.body.appendChild(frame);

  try {
    frame.srcdoc = html;
    await waitForFrameLoad(frame);
    await wait(renderWaitMs);
    const doc = frame.contentDocument;
    const svg = doc?.querySelector("#chart, svg");
    if (!svg) {
      throw new Error("Chart SVG not found for thumbnail.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(targetWidth));
    canvas.height = Math.max(1, Math.floor(targetHeight));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create canvas context.");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const svgImage = await imageFromUrl(svgToDataUrl(svg));
    drawContain(ctx, svgImage, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    frame.remove();
  }
}
