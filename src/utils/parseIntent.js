import { createDefaultIntentSpec } from "../specs/intentSchema.js";

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeMonth(monthMatch) {
  if (!monthMatch) {
    return null;
  }
  const year = monthMatch[1];
  const month = monthMatch[2];
  return `${year}-${month}`;
}

function extractMonth(prompt) {
  const match = prompt.match(/(20\d{2})\s*[-/.年]\s*(0[1-9]|1[0-2])/);
  return normalizeMonth(match);
}

function extractRatio(prompt) {
  const match = prompt.match(/(\d+(?:\.\d+)?)\s*[:：/]\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const left = Number(match[1]);
  const right = Number(match[2]);
  if (!left || !right) {
    return null;
  }
  return right / left;
}

function extractValueCandidates(prompt, month) {
  const cleaned = month ? prompt.replace(month, " ") : prompt;
  const matches = cleaned.match(/-?\d+(?:\.\d+)?/g) || [];
  return matches
    .map((raw) => Number(raw))
    .filter((value) => !Number.isNaN(value))
    .filter((value) => value < 1000);
}

function createIntentId() {
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `intent_${Date.now()}_${random}`;
}

function detectDetailRequested(normalized) {
  return containsAny(normalized, [
    "展开",
    "细节",
    "更细",
    "细一点",
    "详细",
    "显示出来",
    "都显示",
    "更多",
    "单独改",
    "item",
    "detail",
    "show all",
    "fine-grained",
  ]);
}

function createBaseIntent(rawPrompt) {
  const base = createDefaultIntentSpec();
  return {
    ...base,
    intentId: createIntentId(),
    action: rawPrompt ? "show_panel" : base.action,
  };
}

export function parseIntent(prompt) {
  const rawPrompt = String(prompt || "").trim();
  if (!rawPrompt) {
    return createBaseIntent(rawPrompt);
  }

  const normalized = rawPrompt.toLowerCase();
  const month = extractMonth(rawPrompt);
  const ratio = extractRatio(rawPrompt);
  const detailRequested = detectDetailRequested(normalized);

  const isLegend = containsAny(normalized, ["图例", "legend"]);
  const isRemove = containsAny(normalized, ["删", "删除", "移除", "去掉", "remove"]);
  const isAdd = containsAny(normalized, ["新增", "添加", "加一个", "加一行", "增加", "add"]);
  const mentionBulkElementEdit = containsAny(normalized, ["增删", "增减", "编辑元素", "编辑数据", "调增删"]);
  const hasDataWord = containsAny(normalized, [
    "数据",
    "月份",
    "month",
    "行",
    "row",
    "数据表",
    "table",
    "元素",
    "增删",
  ]);
  const isAspect = containsAny(normalized, ["比例", "尺寸", "变高", "拉宽", "变宽", "高一点", "宽一点", "aspect ratio"]);
  const isColorTheme = containsAny(normalized, ["颜色", "配色", "色调", "风格", "主题", "theme", "黄色", "蓝色"]);

  if (isLegend) {
    const direction = containsAny(normalized, ["横", "横着", "水平", "horizontal"])
      ? "horizontal"
      : containsAny(normalized, ["竖", "纵", "vertical"])
        ? "vertical"
        : undefined;
    const fontBigger = containsAny(normalized, ["字体调大", "字体变大", "字大", "调大", "bigger font"]);
    const editItems = containsAny(normalized, ["单独", "每个图例项", "图例项", "item"]);
    const action = direction || fontBigger ? "update" : "show_panel";

    return {
      intentId: createIntentId(),
      intentType: "style",
      task: "legend_edit",
      target: ["legend"],
      action,
      parameters: {
        ...(direction ? { direction } : {}),
        ...(fontBigger ? { fontDelta: 2 } : {}),
        ...(editItems ? { editItems: true } : {}),
      },
      needPanel: true,
      panelStrategy: detailRequested || editItems ? "extend" : "reuse",
      detailRequested: detailRequested || editItems,
    };
  }

  if (isAdd || isRemove || hasDataWord || month) {
    const values = extractValueCandidates(rawPrompt, month);
    const waitingArea = values.length >= 1 ? values[0] : undefined;
    const corridor = values.length >= 2 ? values[1] : undefined;
    const action = mentionBulkElementEdit ? "show_panel" : isAdd ? "add" : isRemove ? "remove" : "show_panel";

    return {
      intentId: createIntentId(),
      intentType: "data",
      task: "element_edit",
      target: ["data"],
      action,
      parameters: {
        ...(month ? { month } : {}),
        ...(waitingArea !== undefined ? { waitingArea } : {}),
        ...(corridor !== undefined ? { corridor } : {}),
      },
      needPanel: true,
      panelStrategy: detailRequested ? "extend" : "reuse",
      detailRequested,
    };
  }

  if (isAspect) {
    const sizeHint = containsAny(normalized, ["拉宽", "变宽", "宽一点", "wider"])
      ? "wider"
      : containsAny(normalized, ["变高", "高一点", "taller"])
        ? "taller"
        : undefined;

    return {
      intentId: createIntentId(),
      intentType: "style",
      task: "aspect_ratio",
      target: ["layout"],
      action: ratio || sizeHint ? "update" : "show_panel",
      parameters: {
        ...(ratio ? { aspectRatio: ratio } : {}),
        ...(sizeHint ? { sizeHint } : {}),
      },
      needPanel: true,
      panelStrategy: detailRequested ? "extend" : "reuse",
      detailRequested,
    };
  }

  if (isColorTheme) {
    const hasExplicitThemeHint = containsAny(normalized, ["柔和", "soft", "冷色", "cool", "蓝调", "暖色", "warm", "暖调"]);
    const themeHint = containsAny(normalized, ["柔和", "soft"])
      ? "soft"
      : containsAny(normalized, ["冷色", "冷", "cool", "蓝"])
        ? "cool"
        : containsAny(normalized, ["暖色", "暖", "warm"])
          ? "warm"
          : undefined;
    const applyPreset = Boolean(themeHint && hasExplicitThemeHint);

    return {
      intentId: createIntentId(),
      intentType: "style",
      task: "color_theme",
      target: ["style"],
      action: applyPreset ? "update" : "show_panel",
      parameters: {
        ...(themeHint ? { themeHint } : {}),
        ...(applyPreset ? { applyPreset: true } : {}),
      },
      needPanel: true,
      panelStrategy: detailRequested ? "extend" : "reuse",
      detailRequested,
    };
  }

  if (detailRequested) {
    return {
      intentId: createIntentId(),
      intentType: "style",
      task: "color_theme",
      target: ["style"],
      action: "show_panel",
      parameters: {},
      needPanel: true,
      panelStrategy: "extend",
      detailRequested: true,
    };
  }

  return createBaseIntent(rawPrompt);
}
