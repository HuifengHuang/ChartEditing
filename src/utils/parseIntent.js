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

export function parseIntent(prompt) {
  const base = createDefaultIntentSpec();
  const rawPrompt = String(prompt || "").trim();
  if (!rawPrompt) {
    return {
      ...base,
      intentId: createIntentId(),
    };
  }

  const normalized = rawPrompt.toLowerCase();
  const month = extractMonth(rawPrompt);
  const ratio = extractRatio(rawPrompt);

  const isExpandControls = containsAny(normalized, ["展开控件", "展开面板", "show controls", "expand controls", "more controls"]);
  const isLegend = containsAny(normalized, ["图例", "legend"]);
  const isRemove = containsAny(normalized, ["删", "删除", "移除", "去掉", "remove"]);
  const isAdd = containsAny(normalized, ["新增", "添加", "加一个", "加一行", "增加", "add"]);
  const hasDataWord = containsAny(normalized, ["数据", "月份", "month", "行", "row"]);
  const isAspect = containsAny(normalized, ["比例", "尺寸", "变高", "拉宽", "变宽", "高一点", "宽一点", "aspect ratio"]);
  const isColorTheme = containsAny(normalized, ["颜色", "配色", "色调", "风格", "主题", "theme"]);

  if (isExpandControls) {
    return {
      intentId: createIntentId(),
      intentType: "style",
      task: "expand_controls",
      target: ["controls"],
      action: "expand_panel",
      parameters: {},
      needPanel: true,
      panelStrategy: "extend",
    };
  }

  if (isLegend) {
    const direction = containsAny(normalized, ["横", "横着", "水平", "horizontal"])
      ? "horizontal"
      : containsAny(normalized, ["竖", "纵", "vertical"])
        ? "vertical"
        : undefined;
    const fontBigger = containsAny(normalized, ["字体调大", "字体变大", "字大", "调大", "bigger font"]);
    const editItems = containsAny(normalized, ["单独", "每个图例项", "图例项", "item"]);

    return {
      intentId: createIntentId(),
      intentType: "style",
      task: "legend_edit",
      target: ["legend"],
      action: "update",
      parameters: {
        ...(direction ? { direction } : {}),
        ...(fontBigger ? { fontDelta: 2 } : {}),
        ...(editItems ? { editItems: true } : {}),
      },
      needPanel: true,
      panelStrategy: editItems ? "extend" : "reuse",
    };
  }

  if (isRemove && (hasDataWord || month)) {
    return {
      intentId: createIntentId(),
      intentType: "data",
      task: "remove_element",
      target: ["data"],
      action: "remove",
      parameters: {
        ...(month ? { month } : {}),
      },
      needPanel: true,
      panelStrategy: "reuse",
    };
  }

  if (isAdd && (hasDataWord || month)) {
    const values = extractValueCandidates(rawPrompt, month);
    const waitingArea = values.length >= 1 ? values[0] : undefined;
    const corridor = values.length >= 2 ? values[1] : undefined;

    return {
      intentId: createIntentId(),
      intentType: "data",
      task: "add_element",
      target: ["data"],
      action: "add",
      parameters: {
        ...(month ? { month } : {}),
        ...(waitingArea !== undefined ? { waitingArea } : {}),
        ...(corridor !== undefined ? { corridor } : {}),
      },
      needPanel: true,
      panelStrategy: "reuse",
    };
  }

  if (isAspect) {
    const isDetailed = containsAny(normalized, ["详细", "微调", "细一点", "detail"]);
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
      action: "update",
      parameters: {
        ...(ratio ? { aspectRatio: ratio } : {}),
        ...(sizeHint ? { sizeHint } : {}),
        ...(isDetailed ? { detail: true } : {}),
      },
      needPanel: true,
      panelStrategy: isDetailed ? "extend" : "reuse",
    };
  }

  if (isColorTheme) {
    const themeHint = containsAny(normalized, ["柔和", "soft"])
      ? "soft"
      : containsAny(normalized, ["冷色", "冷", "cool", "蓝"])
        ? "cool"
        : containsAny(normalized, ["暖色", "暖", "warm"])
          ? "warm"
          : undefined;
    const detail = containsAny(normalized, ["细", "详细", "具体颜色"]);

    return {
      intentId: createIntentId(),
      intentType: "style",
      task: "color_theme",
      target: ["style"],
      action: "show_panel",
      parameters: {
        ...(themeHint ? { themeHint } : {}),
        ...(detail ? { detail: true } : {}),
      },
      needPanel: true,
      panelStrategy: detail ? "extend" : "reuse",
    };
  }

  return {
    ...base,
    intentId: createIntentId(),
    action: "show_panel",
  };
}
