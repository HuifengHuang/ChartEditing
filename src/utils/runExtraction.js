import { getValueByPath, setValueByPath } from "./pathUtils.js";
import { validateExtractionResult } from "./extractionResultValidator.js";

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
}

function inferValueType(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }
  if (typeof value === "boolean") {
    return "bool";
  }
  if (typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) {
    return "color";
  }
  return "text";
}

function ensureField(sourceData, path, fallbackValue) {
  const current = getValueByPath(sourceData, path);
  if (current !== undefined) {
    return current;
  }
  setValueByPath(sourceData, path, fallbackValue);
  return fallbackValue;
}

function createBinding(sourceData, path, fallbackValue, forceType = null) {
  const value = ensureField(sourceData, path, fallbackValue);
  return {
    name: path,
    type: forceType || inferValueType(value),
    value,
  };
}

function createInputPlaceholder() {
  return [
    { name: "image-x", type: "number", value: 0 },
    { name: "image-y", type: "number", value: 0 },
    { name: "image-width", type: "number", value: 100 },
    { name: "image-height", type: "number", value: 100 },
  ];
}

function replaceLine(code, pattern, replacement, codePatches, reason) {
  const next = code.replace(pattern, replacement);
  if (next !== code) {
    codePatches.push({
      type: "replace-line",
      reason,
      replacement,
    });
  }
  return next;
}

function insertAfterAnchor(code, anchor, snippet, codePatches, reason) {
  if (code.includes(snippet.trim())) {
    return code;
  }
  const index = code.indexOf(anchor);
  if (index < 0) {
    return code;
  }
  const insertAt = index + anchor.length;
  const next = `${code.slice(0, insertAt)}\n${snippet}${code.slice(insertAt)}`;
  codePatches.push({
    type: "insert-after",
    reason,
    anchor,
  });
  return next;
}

function insertBeforeAnchor(code, anchor, snippet, codePatches, reason) {
  if (code.includes(snippet.trim())) {
    return code;
  }
  const index = code.indexOf(anchor);
  if (index < 0) {
    return code;
  }
  const next = `${code.slice(0, index)}${snippet}\n${code.slice(index)}`;
  codePatches.push({
    type: "insert-before",
    reason,
    anchor,
  });
  return next;
}

function ensureSizeExtraction(sourceData, renderCode, extractionMap, bindingMap, codePatches, parameterName) {
  const layoutWidth = Number(ensureField(sourceData, "layout.svgWidth", 420));
  const layoutHeight = Number(ensureField(sourceData, "layout.svgHeight", 520));

  let nextRenderCode = renderCode;
  if (/const svgWidth = \d+/.test(nextRenderCode)) {
    nextRenderCode = replaceLine(
      nextRenderCode,
      /const svgWidth = [^\n]*;/,
      "const svgWidth = clampNumber(layout.svgWidth, 420, 280, 1200);",
      codePatches,
      "Extract width binding from hardcoded literal to source_data.layout.svgWidth"
    );
  }
  if (/const svgHeight = \d+/.test(nextRenderCode)) {
    nextRenderCode = replaceLine(
      nextRenderCode,
      /const svgHeight = [^\n]*;/,
      "const svgHeight = clampNumber(layout.svgHeight, 520, 320, 1200);",
      codePatches,
      "Extract height binding from hardcoded literal to source_data.layout.svgHeight"
    );
  }

  const allBindings = [
    { name: "layout.svgWidth", type: "number", value: layoutWidth },
    { name: "layout.svgHeight", type: "number", value: layoutHeight },
  ];
  const primaryBindings =
    parameterName === "chart_width"
      ? [allBindings[0]]
      : parameterName === "chart_height"
        ? [allBindings[1]]
        : allBindings;

  extractionMap[parameterName] = {
    primaryBindings,
  };
  bindingMap[parameterName] = primaryBindings.map((binding) => binding.name);

  return nextRenderCode;
}

function ensureColorThemeExtraction(sourceData, renderCode, extractionMap, bindingMap) {
  void renderCode;
  const stylePaths = [
    "style.waitingAreaColor",
    "style.corridorColor",
    "style.titleColor",
    "style.subtitleColor",
  ];

  const recommendations = [
    {
      id: "warm",
      label: "Warm",
      values: {
        "style.waitingAreaColor": "#c75b4e",
        "style.corridorColor": "#efc45a",
        "style.titleColor": "#78350f",
        "style.subtitleColor": "#92400e",
      },
    },
    {
      id: "cool",
      label: "Cool",
      values: {
        "style.waitingAreaColor": "#2563eb",
        "style.corridorColor": "#38bdf8",
        "style.titleColor": "#0f172a",
        "style.subtitleColor": "#334155",
      },
    },
    {
      id: "soft",
      label: "Soft",
      values: {
        "style.waitingAreaColor": "#d97795",
        "style.corridorColor": "#f9c66e",
        "style.titleColor": "#4b5563",
        "style.subtitleColor": "#6b7280",
      },
    },
  ];

  const primaryBindings = stylePaths.map((path) => {
    ensureField(sourceData, path, recommendations[0].values[path]);
    return {
      name: path,
      type: "color",
      value: recommendations.map((item) => item.values[path]),
    };
  });

  extractionMap.color_theme = {
    recommendation: recommendations,
    primaryBindings,
  };
  bindingMap.color_theme = stylePaths;
}

function ensureTriangleStyleExtraction(sourceData, renderCode, extractionMap, bindingMap, codePatches) {
  const defaultColor = getValueByPath(sourceData, "style.corridorColor") || "#efc45a";
  const triangleBaseWidth = ensureField(sourceData, "style.triangleBaseWidth", 10);
  const triangleColor = ensureField(sourceData, "style.triangleColor", defaultColor);
  const triangleBorderWidth = ensureField(sourceData, "style.triangleBorderWidth", 2);

  const recommendations = [
    {
      id: "triangle_soft",
      label: "Soft Triangle",
      values: {
        "style.triangleBaseWidth": 10,
        "style.triangleColor": "#fbbf24",
        "style.triangleBorderWidth": 1.5,
      },
    },
    {
      id: "triangle_strong",
      label: "Strong Triangle",
      values: {
        "style.triangleBaseWidth": 14,
        "style.triangleColor": "#fb7185",
        "style.triangleBorderWidth": 2.5,
      },
    },
    {
      id: "triangle_neon",
      label: "Neon Triangle",
      values: {
        "style.triangleBaseWidth": 18,
        "style.triangleColor": "#22d3ee",
        "style.triangleBorderWidth": 3,
      },
    },
  ];

  let nextRenderCode = renderCode;
  const colorAnchor = '  const cardBackgroundColor = style.cardBackgroundColor || "#ffffff";';
  const triangleVarSnippet = `  const triangleBaseWidth = clampNumber(style.triangleBaseWidth, 10, 4, 64);
  const triangleColor = style.triangleColor || corridorColor;
  const triangleBorderWidth = clampNumber(style.triangleBorderWidth, 2, 0, 10);`;

  nextRenderCode = insertAfterAnchor(
    nextRenderCode,
    colorAnchor,
    triangleVarSnippet,
    codePatches,
    "Bind triangle style variables to source_data.style"
  );

  const triangleSnippet = `  rows
    .append("path")
    .attr("class", "triangle-marker")
    .attr("d", function() {
      const half = triangleBaseWidth / 2;
      const midY = barHeight / 2;
      const topY = midY - triangleBaseWidth * 0.32;
      const bottomY = midY + triangleBaseWidth * 0.32;
      return "M" + centerX + "," + topY + "L" + (centerX + half) + "," + bottomY + "L" + (centerX - half) + "," + bottomY + "Z";
    })
    .attr("fill", triangleColor)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", triangleBorderWidth)
    .attr("opacity", 0.95);`;

  nextRenderCode = insertBeforeAnchor(
    nextRenderCode,
    '  rows\n    .append("rect")',
    triangleSnippet,
    codePatches,
    "Insert triangle markers driven by source_data.style"
  );

  const primaryBindings = [
    { name: "style.triangleBaseWidth", type: "number", value: triangleBaseWidth },
    { name: "style.triangleColor", type: "color", value: triangleColor },
    { name: "style.triangleBorderWidth", type: "number", value: triangleBorderWidth },
  ];

  extractionMap.triangle_style = {
    recommendation: recommendations,
    primaryBindings: primaryBindings.map((binding) => ({
      ...binding,
      value:
        binding.type === "number"
          ? recommendations.map((item) => item.values[binding.name])
          : recommendations.map((item) => item.values[binding.name]),
    })),
  };
  bindingMap.triangle_style = primaryBindings.map((binding) => binding.name);

  return nextRenderCode;
}

function ensureDataExtraction(sourceData, extractionMap) {
  const affected = [
    createBinding(sourceData, "layout.svgWidth", 420, "number"),
    createBinding(sourceData, "layout.svgHeight", 520, "number"),
    createBinding(sourceData, "layout.rowStep", 27.3, "number"),
    createBinding(sourceData, "layout.labelGap", 66, "number"),
    createBinding(sourceData, "title.titleLines.0", "Chart Title", "text"),
    createBinding(sourceData, "title.subtitleLines.0", "Chart Subtitle", "text"),
  ];

  extractionMap.data_table = {
    data: Array.isArray(sourceData.data) ? safeClone(sourceData.data) : [],
    affected,
  };
}

function ensureStyleBaselineExtraction(sourceData, renderCode, extractionMap, bindingMap, codePatches) {
  let nextRenderCode = renderCode;
  // Baseline: width/height + theme colors should be materialized into source_data
  // right after LLM interaction, even if parameters are vague.
  nextRenderCode = ensureSizeExtraction(
    sourceData,
    nextRenderCode,
    extractionMap,
    bindingMap,
    codePatches,
    "aspect_ratio"
  );
  ensureColorThemeExtraction(sourceData, nextRenderCode, extractionMap, bindingMap);
  return nextRenderCode;
}

export function runExtraction(intent, parts) {
  const sourceData = safeClone(parts?.source_data || {});
  let renderCode = String(parts?.render_code || "");
  const parameters = asObject(intent?.parameters);
  const target = String(intent?.target || "").toLowerCase();
  const extractionMap = {};
  const bindingMap = {};
  const codePatches = [];

  const parameterEntries = Object.entries(parameters);

  parameterEntries.forEach(([parameterName, parameterValue]) => {
    const key = String(parameterName || "");
    const value = String(parameterValue || "");
    const lowerKey = key.toLowerCase();
    const lowerValue = value.toLowerCase();

    if (lowerKey === "input" && lowerValue === "none") {
      createInputPlaceholder().forEach((item) => {
        ensureField(sourceData, `input.${item.name}`, item.value);
      });
      extractionMap[key] = {
        input: createInputPlaceholder(),
      };
      bindingMap[key] = ["input.image-x", "input.image-y", "input.image-width", "input.image-height"];
      return;
    }

    if (/data|table|row|month/i.test(lowerKey) || String(intent?.target || "").toLowerCase() === "data") {
      ensureDataExtraction(sourceData, extractionMap);
      if (key !== "data_table") {
        extractionMap[key] = extractionMap.data_table;
      }
      bindingMap[key] = ["data", "layout.svgWidth", "layout.svgHeight", "layout.rowStep", "title.titleLines.0"];
      return;
    }

    if (lowerKey === "chart_width" || lowerKey === "chart_height" || lowerKey === "aspect_ratio") {
      renderCode = ensureSizeExtraction(sourceData, renderCode, extractionMap, bindingMap, codePatches, lowerKey);
      return;
    }

    if (lowerKey === "color_theme" || lowerKey === "legend_color") {
      ensureColorThemeExtraction(sourceData, renderCode, extractionMap, bindingMap);
      return;
    }

    if (lowerKey === "triangle_style" || lowerKey.includes("triangle")) {
      renderCode = ensureTriangleStyleExtraction(sourceData, renderCode, extractionMap, bindingMap, codePatches);
      return;
    }

    if (lowerValue === "recommendation") {
      extractionMap[key] = {
        recommendation: [],
        primaryBindings: [],
      };
      return;
    }

    if (lowerValue === "preset") {
      extractionMap[key] = {
        primaryBindings: [],
      };
      return;
    }

    extractionMap[key] = {};
  });

  // Always trigger baseline style extraction right after model interaction,
  // so source_data fields are materialized immediately (not waiting for UI clicks).
  if (target === "style") {
    renderCode = ensureStyleBaselineExtraction(sourceData, renderCode, extractionMap, bindingMap, codePatches);
  }

  if (target === "data" && !extractionMap.data_table) {
    ensureDataExtraction(sourceData, extractionMap);
  }

  return validateExtractionResult(
    {
      sourceData,
      renderCode,
      extractionMap,
      bindingMap,
      codePatches,
    },
    parts
  );
}
