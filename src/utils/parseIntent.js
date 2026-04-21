import { createDefaultIntentSpec } from "../specs/intentSchema.js";
import { validateIntentSpec } from "../llm/intentSchemaValidator.js";

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizePrompt(rawPrompt) {
  return String(rawPrompt || "").trim();
}

function createIntent(patch) {
  const base = createDefaultIntentSpec();
  return validateIntentSpec({
    ...base,
    ...patch,
  });
}

function detectExpand(normalized) {
  return containsAny(normalized, [
    "展开",
    "细节",
    "更细",
    "更多",
    "详细",
    "单独",
    "item",
    "detail",
    "show all",
    "fine-grained",
  ]);
}

export function parseIntent(prompt) {
  const rawPrompt = normalizePrompt(prompt);
  if (!rawPrompt) {
    return createIntent({
      User_prompt: "",
      target: "style",
      action: "update",
      expand: false,
      parameters: {},
    });
  }

  const normalized = rawPrompt.toLowerCase();
  const expand = detectExpand(normalized);

  const isUpload = containsAny(normalized, [
    "上传",
    "upload",
    "svg",
    "图片",
    "图像",
    "image",
  ]);
  if (isUpload) {
    return createIntent({
      User_prompt: rawPrompt,
      target: "other",
      action: "add",
      expand: false,
      parameters: {
        Input: "None",
      },
    });
  }

  const isLegend = containsAny(normalized, ["图例", "legend"]);
  const isColorTheme = containsAny(normalized, ["颜色", "配色", "色调", "风格", "主题", "theme", "soft", "柔和"]);
  const asksRecommendation = containsAny(normalized, ["推荐", "几个", "几种", "给我一些", "soft", "柔和"]);
  if (isColorTheme) {
    return createIntent({
      User_prompt: rawPrompt,
      target: "style",
      action: "update",
      expand: expand || asksRecommendation,
      parameters: {
        [isLegend ? "legend_color" : "color_theme"]: asksRecommendation ? "Recommendation" : "Preset",
      },
    });
  }

  const isWidth = containsAny(normalized, ["宽度", "宽", "width"]);
  const isHeight = containsAny(normalized, ["高度", "高", "height"]);
  const isAspect = containsAny(normalized, ["比例", "纵横比", "aspect"]);
  if ((isWidth && isHeight) || isAspect) {
    const parameters = {};
    if (isWidth) {
      parameters.chart_width = "Preset";
    }
    if (isHeight) {
      parameters.chart_height = "Preset";
    }
    if (!isWidth && !isHeight) {
      parameters.aspect_ratio = "Preset";
    }
    return createIntent({
      User_prompt: rawPrompt,
      target: "style",
      action: "update",
      expand: false,
      parameters,
    });
  }

  const isTriangle = containsAny(normalized, ["三角", "triangle"]);
  if (isTriangle) {
    return createIntent({
      User_prompt: rawPrompt,
      target: "style",
      action: "update",
      expand: expand || true,
      parameters: {
        triangle_style: "Recommendation",
      },
    });
  }

  const isAdd = containsAny(normalized, ["新增", "添加", "增加", "加一", "add"]);
  const isRemove = containsAny(normalized, ["删除", "移除", "去掉", "删", "remove"]);
  const hasDataWord = containsAny(normalized, ["数据", "行", "row", "table", "month", "月份", "元素"]);
  if (isAdd || isRemove || hasDataWord) {
    return createIntent({
      User_prompt: rawPrompt,
      target: "data",
      action: isAdd ? "add" : isRemove ? "remove" : "update",
      expand,
      parameters: {
        data_table: "Preset",
      },
    });
  }

  if (isLegend) {
    return createIntent({
      User_prompt: rawPrompt,
      target: "style",
      action: "update",
      expand,
      parameters: {
        legend_style: "Preset",
      },
    });
  }

  return createIntent({
    User_prompt: rawPrompt,
    target: "style",
    action: "update",
    expand,
    parameters: {
      color_theme: "Preset",
    },
  });
}
