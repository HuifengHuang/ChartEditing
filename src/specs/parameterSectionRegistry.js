function normalizeKey(key) {
  return String(key || "").trim().toLowerCase();
}

const DIRECT_MAP = {
  chart_width: {
    task: "aspect_ratio",
    primarySectionId: "layout_primary",
    primaryTitle: "Layout",
    detailSectionId: "layout_detail",
    detailTitle: "Layout Detail",
    impactPolicy: "show-affected-controls",
  },
  chart_height: {
    task: "aspect_ratio",
    primarySectionId: "layout_primary",
    primaryTitle: "Layout",
    detailSectionId: "layout_detail",
    detailTitle: "Layout Detail",
    impactPolicy: "show-affected-controls",
  },
  aspect_ratio: {
    task: "aspect_ratio",
    primarySectionId: "layout_primary",
    primaryTitle: "Layout",
    detailSectionId: "layout_detail",
    detailTitle: "Layout Detail",
    impactPolicy: "show-affected-controls",
  },
  color_theme: {
    task: "color_theme",
    primarySectionId: "theme_primary",
    primaryTitle: "Color Theme",
    detailSectionId: "theme_detail",
    detailTitle: "Theme Detail",
    impactPolicy: "mixed",
  },
  triangle_style: {
    task: "triangle_style",
    primarySectionId: "style_primary",
    primaryTitle: "Style",
    detailSectionId: "style_detail",
    detailTitle: "Style Detail",
    impactPolicy: "mixed",
  },
  legend: {
    task: "legend_edit",
    primarySectionId: "legend_primary",
    primaryTitle: "Legend",
    detailSectionId: "legend_detail",
    detailTitle: "Legend Detail",
    impactPolicy: "show-affected-controls",
  },
  legend_orientation: {
    task: "legend_edit",
    primarySectionId: "legend_primary",
    primaryTitle: "Legend",
    detailSectionId: "legend_detail",
    detailTitle: "Legend Detail",
    impactPolicy: "show-affected-controls",
  },
  data: {
    task: "element_edit",
    primarySectionId: "data_table",
    primaryTitle: "Data Table",
    detailSectionId: "data_layout_policy",
    detailTitle: "Data Affected",
    impactPolicy: "show-affected-controls",
  },
  data_table: {
    task: "element_edit",
    primarySectionId: "data_table",
    primaryTitle: "Data Table",
    detailSectionId: "data_layout_policy",
    detailTitle: "Data Affected",
    impactPolicy: "show-affected-controls",
  },
  input: {
    task: "other_input",
    primarySectionId: "asset_input",
    primaryTitle: "Asset Input",
    detailSectionId: "asset_input_detail",
    detailTitle: "Asset Input Detail",
    impactPolicy: "show-affected-controls",
  },
};

function inferByPattern(rawKey) {
  const key = normalizeKey(rawKey);
  if (DIRECT_MAP[key]) {
    return DIRECT_MAP[key];
  }
  if (key.includes("width") || key.includes("height") || key.includes("aspect") || key.includes("layout")) {
    return DIRECT_MAP.aspect_ratio;
  }
  if (key.includes("color") || key.includes("theme") || key.includes("palette") || key.includes("style")) {
    return DIRECT_MAP.color_theme;
  }
  if (key.includes("triangle")) {
    return DIRECT_MAP.triangle_style;
  }
  if (key.includes("legend")) {
    return DIRECT_MAP.legend;
  }
  if (key.includes("data") || key.includes("table") || key.includes("row") || key.includes("month")) {
    return DIRECT_MAP.data;
  }
  return {
    task: "color_theme",
    primarySectionId: "theme_primary",
    primaryTitle: "Style",
    detailSectionId: "theme_detail",
    detailTitle: "Style Detail",
    impactPolicy: "mixed",
  };
}

export function resolveParameterSection(parameterName, intentTarget = "style") {
  const fromParam = inferByPattern(parameterName);
  const target = normalizeKey(intentTarget);

  if (target === "data" && fromParam.task === "color_theme") {
    return DIRECT_MAP.data;
  }
  if (target === "other" && normalizeKey(parameterName) === "input") {
    return DIRECT_MAP.input;
  }
  return fromParam;
}
