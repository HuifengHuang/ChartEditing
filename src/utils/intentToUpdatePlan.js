import {
  getTaskDetailSectionIds,
  getTaskPrimarySectionId,
} from "../specs/taskControlRegistry.js";

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function normalizeParameterKeys(parameters) {
  return Object.keys(asObject(parameters)).map((key) => key.toLowerCase());
}

function hasAnyKey(keys, patterns) {
  return patterns.some((pattern) => keys.some((key) => key.includes(pattern)));
}

function mapIntentToLegacy(intentSpec, extractionMap = {}) {
  const intent = asObject(intentSpec);
  const legacyTask = String(intent.task || "").trim();
  if (legacyTask) {
    return {
      task: legacyTask,
      action: String(intent.action || "update").toLowerCase() === "show_panel" ? "update" : String(intent.action || "update"),
      detailRequested: Boolean(intent.detailRequested ?? intent.expand),
      parameters: asObject(intent.parameters),
    };
  }

  const target = String(intent.target || "style").toLowerCase();
  const action = String(intent.action || "update").toLowerCase();
  const parameters = asObject(intent.parameters);
  const keys = normalizeParameterKeys(parameters);
  const extractionKeys = Object.keys(asObject(extractionMap)).map((key) => String(key || "").toLowerCase());
  const allKeys = [...keys, ...extractionKeys];

  const isInput = allKeys.includes("input") && String(parameters.Input || parameters.input || "").toLowerCase() === "none";
  if (target === "other" && isInput) {
    return {
      task: "other_input",
      action: "add",
      detailRequested: false,
      parameters,
    };
  }

  let task = "color_theme";
  if (
    target === "data" ||
    action === "add" ||
    action === "remove" ||
    hasAnyKey(allKeys, ["data", "table", "row", "month"])
  ) {
    task = "element_edit";
  } else if (hasAnyKey(allKeys, ["triangle"])) {
    task = "triangle_style";
  } else if (hasAnyKey(allKeys, ["legend"])) {
    task = "legend_edit";
  } else if (hasAnyKey(allKeys, ["color", "theme", "palette", "style"])) {
    task = "color_theme";
  } else if (hasAnyKey(allKeys, ["width", "height", "aspect", "ratio", "layout"])) {
    task = "aspect_ratio";
  }

  return {
    task,
    action: action === "add" || action === "remove" || action === "update" ? action : "update",
    detailRequested: Boolean(intent.expand),
    parameters,
  };
}

function hasSection(panelSpec, sectionId) {
  return (panelSpec?.sections || []).some((section) => section.sectionId === sectionId);
}

function ensureTaskPanel(plan, currentPanelSpec, task, { highlight = true } = {}) {
  const sectionId = getTaskPrimarySectionId(task);
  if (hasSection(currentPanelSpec, sectionId)) {
    plan.panelUpdates.push({ type: "ensure-task-controls", task });
  } else {
    plan.panelUpdates.push({ type: "create-section-with-controls", task });
  }
  if (highlight) {
    plan.panelUpdates.push({ type: "highlight-section", sectionId });
  }
}

function expandTaskDetails(plan, task) {
  const detailSectionIds = getTaskDetailSectionIds(task);
  detailSectionIds.forEach((sectionId) => {
    plan.panelUpdates.push({ type: "expand-section", sectionId });
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeAspectRatioUpdates(parameters, currentParts) {
  const currentLayout = currentParts?.source_data?.layout || {};
  const currentWidth = Number(currentLayout.svgWidth) || 420;
  const currentHeight = Number(currentLayout.svgHeight) || 520;
  const currentRatio = currentWidth > 0 ? currentHeight / currentWidth : 1.2;
  const targetRatio = Number(parameters.aspectRatio) > 0 ? Number(parameters.aspectRatio) : currentRatio;

  let nextWidth = currentWidth;
  let nextHeight = Math.round(nextWidth * targetRatio);

  if (parameters.sizeHint === "wider") {
    nextWidth = currentWidth + 60;
    nextHeight = Math.round(nextWidth * targetRatio);
  }
  if (parameters.sizeHint === "taller") {
    nextHeight = currentHeight + 60;
    nextWidth = Math.round(nextHeight / targetRatio);
  }

  nextWidth = clamp(nextWidth, 280, 1200);
  nextHeight = clamp(nextHeight, 320, 1200);

  const oldHeight = currentHeight || 1;
  const scaleY = nextHeight / oldHeight;
  const nextChartBottom = Math.round((Number(currentLayout.chartBottom) || 382) * scaleY);
  const nextTitleY = Math.round((Number(currentLayout.titleY) || 438) * scaleY);
  const nextSubtitleY = Math.round((Number(currentLayout.subtitleY) || 488) * scaleY);

  return [
    { type: "set", path: "source_data.layout.aspectRatio", value: targetRatio },
    { type: "set", path: "source_data.layout.svgWidth", value: nextWidth },
    { type: "set", path: "source_data.layout.svgHeight", value: nextHeight },
    { type: "set", path: "source_data.layout.chartBottom", value: nextChartBottom },
    { type: "set", path: "source_data.layout.titleY", value: nextTitleY },
    { type: "set", path: "source_data.layout.subtitleY", value: nextSubtitleY },
    { type: "set", path: "source_data.meta.aspectRatioPreset", value: "custom" },
  ];
}

function createThemePatchByHint(themeHint) {
  if (themeHint === "cool") {
    return {
      "source_data.style.waitingAreaColor": "#2563eb",
      "source_data.style.corridorColor": "#38bdf8",
      "source_data.style.titleColor": "#0f172a",
      "source_data.style.subtitleColor": "#334155",
      "source_data.style.textMidColor": "#475569",
      "source_data.style.textLightColor": "#64748b",
    };
  }

  if (themeHint === "warm") {
    return {
      "source_data.style.waitingAreaColor": "#c75b4e",
      "source_data.style.corridorColor": "#efc45a",
      "source_data.style.titleColor": "#78350f",
      "source_data.style.subtitleColor": "#92400e",
      "source_data.style.textMidColor": "#7c2d12",
      "source_data.style.textLightColor": "#9a3412",
    };
  }

  if (themeHint === "soft") {
    return {
      "source_data.style.waitingAreaColor": "#d97795",
      "source_data.style.corridorColor": "#f9c66e",
      "source_data.style.titleColor": "#4b5563",
      "source_data.style.subtitleColor": "#6b7280",
      "source_data.style.textMidColor": "#6b7280",
      "source_data.style.textLightColor": "#9ca3af",
    };
  }

  return null;
}

function parseMonthAsIndex(monthText) {
  const match = String(monthText || "").match(/(20\d{2})-(0[1-9]|1[0-2])/);
  if (!match) {
    return 1;
  }
  return Number(match[2]);
}

function createAddedDataRow(parameters) {
  const month = parameters.month || "2024-01";
  const monthIndex = parseMonthAsIndex(month);
  const waitingDefault = 7 + monthIndex / 10;
  const corridorDefault = 6.6 + monthIndex / 10;
  return {
    month,
    waitingArea: Number(parameters.waitingArea ?? waitingDefault).toFixed(1) * 1,
    corridor: Number(parameters.corridor ?? corridorDefault).toFixed(1) * 1,
  };
}

function maybeCreateAutoSpacingUpdate(currentParts, deltaCount) {
  const layout = currentParts?.source_data?.layout || {};
  const fixed = Boolean(layout.fixedChartSize);
  if (fixed) {
    return null;
  }

  const currentData = currentParts?.source_data?.data || [];
  const nextCount = Math.max(1, currentData.length + deltaCount);
  const top = Number(layout.chartTop) || 54;
  const bottom = Number(layout.chartBottom) || 382;
  const span = Math.max(40, bottom - top);
  const rowStep = Number((span / nextCount).toFixed(2));
  return { type: "set", path: "source_data.layout.rowStep", value: rowStep };
}

function isAction(intentSpec, action) {
  return String(intentSpec?.action || "") === action;
}

function inferControlType(bindingType) {
  if (bindingType === "number") {
    return "number";
  }
  if (bindingType === "color") {
    return "color";
  }
  if (bindingType === "bool") {
    return "toggle";
  }
  return "text";
}

function inferValueType(controlType) {
  if (controlType === "number") {
    return "number";
  }
  if (controlType === "color") {
    return "color";
  }
  if (controlType === "toggle") {
    return "boolean";
  }
  return "string";
}

function createBindingControl(binding, prefix) {
  const name = String(binding?.name || "").trim();
  if (!name) {
    return null;
  }
  const controlType = inferControlType(binding?.type);
  const valueType = inferValueType(controlType);
  const lastName = name.split(".").pop() || name;
  return {
    id: `${prefix}_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`.toLowerCase(),
    label: lastName,
    controlType,
    operationType: "update",
    bindingMode: "single",
    bind: name.startsWith("source_data.") ? name : `source_data.${name}`,
    valueType,
  };
}

function appendBindingSection(plan, sectionId, sectionTitle, bindings, prefix) {
  const list = Array.isArray(bindings) ? bindings : [];
  if (!list.length) {
    return;
  }
  plan.panelUpdates.push({
    type: "create-section",
    payload: {
      sectionId,
      title: sectionTitle,
      priority: "primary",
      controls: [],
    },
  });
  list.forEach((binding) => {
    const control = createBindingControl(binding, prefix);
    if (!control) {
      return;
    }
    plan.panelUpdates.push({
      type: "insert-control",
      sectionId,
      payload: control,
    });
  });
  plan.panelUpdates.push({
    type: "highlight-section",
    sectionId,
  });
}

export function intentToUpdatePlan(intentSpec, extractionResult, currentPanelSpec) {
  const plan = {
    sourceDataUpdates: [],
    panelUpdates: [],
  };
  const extractionMap = asObject(extractionResult?.extractionMap);
  const currentParts = {
    source_data: extractionResult?.sourceData || {},
  };
  const normalizedIntent = mapIntentToLegacy(intentSpec, extractionMap);

  if (normalizedIntent.task === "other_input") {
    const inputEntry = extractionMap.Input || extractionMap.input || {};
    appendBindingSection(
      plan,
      "upload_input_controls",
      "Upload Input",
      inputEntry.input || [],
      "input"
    );
    return plan;
  }

  if (normalizedIntent.task === "aspect_ratio") {
    ensureTaskPanel(plan, currentPanelSpec, "aspect_ratio");
    if (
      isAction(normalizedIntent, "update") &&
      (normalizedIntent.parameters?.aspectRatio || normalizedIntent.parameters?.sizeHint)
    ) {
      plan.sourceDataUpdates.push(...computeAspectRatioUpdates(normalizedIntent.parameters, currentParts));
    }
    if (normalizedIntent.detailRequested) {
      expandTaskDetails(plan, "aspect_ratio");
    }
    return plan;
  }

  if (normalizedIntent.task === "color_theme") {
    ensureTaskPanel(plan, currentPanelSpec, "color_theme");
    const patch =
      normalizedIntent.parameters?.applyPreset === true
        ? createThemePatchByHint(normalizedIntent.parameters?.themeHint)
        : null;
    if (patch) {
      plan.sourceDataUpdates.push({ type: "patch", patch });
    }
    if (normalizedIntent.detailRequested) {
      expandTaskDetails(plan, "color_theme");
    }
    return plan;
  }

  if (normalizedIntent.task === "element_edit") {
    ensureTaskPanel(plan, currentPanelSpec, "element_edit");

    if (isAction(normalizedIntent, "add")) {
      plan.sourceDataUpdates.push({
        type: "add",
        targetCollection: "source_data.data",
        value: createAddedDataRow(normalizedIntent.parameters || {}),
      });
      const spacingUpdate = maybeCreateAutoSpacingUpdate(currentParts, 1);
      if (spacingUpdate) {
        plan.sourceDataUpdates.push(spacingUpdate);
      }
    }

    if (isAction(normalizedIntent, "remove") && normalizedIntent.parameters?.month) {
      plan.sourceDataUpdates.push({
        type: "remove",
        targetCollection: "source_data.data",
        matcher: {
          rowKey: "month",
          value: normalizedIntent.parameters.month,
        },
      });
      const spacingUpdate = maybeCreateAutoSpacingUpdate(currentParts, -1);
      if (spacingUpdate) {
        plan.sourceDataUpdates.push(spacingUpdate);
      }
    } else if (isAction(normalizedIntent, "remove")) {
      const rows = currentParts?.source_data?.data || [];
      if (rows.length) {
        plan.sourceDataUpdates.push({
          type: "remove",
          targetCollection: "source_data.data",
          matcher: {
            index: rows.length - 1,
          },
        });
        const spacingUpdate = maybeCreateAutoSpacingUpdate(currentParts, -1);
        if (spacingUpdate) {
          plan.sourceDataUpdates.push(spacingUpdate);
        }
      }
    }

    if (normalizedIntent.detailRequested) {
      plan.sourceDataUpdates.push({
        type: "set",
        path: "source_data.layout.fixedChartSize",
        value: false,
      });
      expandTaskDetails(plan, "element_edit");
    }

    return plan;
  }

  if (normalizedIntent.task === "legend_edit") {
    ensureTaskPanel(plan, currentPanelSpec, "legend_edit");

    if (normalizedIntent.parameters?.direction) {
      plan.sourceDataUpdates.push({
        type: "set",
        path: "source_data.legend.legendDirection",
        value: normalizedIntent.parameters.direction,
      });
    }

    if (normalizedIntent.parameters?.fontDelta) {
      const current = Number(currentParts?.source_data?.legend?.legendFontSize) || 12;
      plan.sourceDataUpdates.push({
        type: "set",
        path: "source_data.legend.legendFontSize",
        value: clamp(current + Number(normalizedIntent.parameters.fontDelta), 9, 30),
      });
    }

    if (normalizedIntent.detailRequested || normalizedIntent.parameters?.editItems) {
      expandTaskDetails(plan, "legend_edit");
    }

    return plan;
  }

  if (normalizedIntent.task === "triangle_style") {
    const triangleEntry = extractionMap.triangle_style || extractionMap.triangle || {};
    appendBindingSection(
      plan,
      "triangle_style",
      "Triangle Style",
      triangleEntry.primaryBindings || [],
      "triangle"
    );
    return plan;
  }

  ensureTaskPanel(plan, currentPanelSpec, "color_theme");
  return plan;
}
