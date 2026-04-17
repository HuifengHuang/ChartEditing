import { getTaskPrimarySectionId } from "../specs/taskControlRegistry.js";

function hasSection(panelSpec, sectionId) {
  return (panelSpec?.sections || []).some((section) => section.sectionId === sectionId);
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

export function intentToUpdatePlan(intentSpec, currentParts, currentPanelSpec) {
  const plan = {
    sourceDataUpdates: [],
    panelUpdates: [],
  };

  const sectionId = getTaskPrimarySectionId(intentSpec.task);
  if (hasSection(currentPanelSpec, sectionId)) {
    plan.panelUpdates.push({ type: "ensure-task-controls", task: intentSpec.task });
    plan.panelUpdates.push({ type: "highlight-section", sectionId });
  } else {
    plan.panelUpdates.push({
      type: "create-section-with-controls",
      task: intentSpec.task,
    });
    plan.panelUpdates.push({ type: "highlight-section", sectionId });
  }

  if (intentSpec.task === "aspect_ratio") {
    if (intentSpec.parameters?.aspectRatio || intentSpec.parameters?.sizeHint) {
      plan.sourceDataUpdates.push(...computeAspectRatioUpdates(intentSpec.parameters, currentParts));
    }
    if (intentSpec.parameters?.detail || !intentSpec.parameters?.aspectRatio) {
      plan.panelUpdates.push({ type: "expand-section", sectionId: "layout_detail" });
    }
    return plan;
  }

  if (intentSpec.task === "color_theme") {
    const patch = createThemePatchByHint(intentSpec.parameters?.themeHint);
    if (patch) {
      plan.sourceDataUpdates.push({ type: "patch", patch });
    }
    if (intentSpec.parameters?.detail) {
      plan.panelUpdates.push({ type: "expand-section", sectionId: "theme_detail" });
    }
    return plan;
  }

  if (intentSpec.task === "add_element") {
    if (intentSpec.parameters?.month) {
      plan.sourceDataUpdates.push({
        type: "add",
        targetCollection: "source_data.data",
        value: createAddedDataRow(intentSpec.parameters),
      });
      const spacingUpdate = maybeCreateAutoSpacingUpdate(currentParts, 1);
      if (spacingUpdate) {
        plan.sourceDataUpdates.push(spacingUpdate);
      }
    }
    return plan;
  }

  if (intentSpec.task === "remove_element") {
    if (intentSpec.parameters?.month) {
      plan.sourceDataUpdates.push({
        type: "remove",
        targetCollection: "source_data.data",
        matcher: {
          rowKey: "month",
          value: intentSpec.parameters.month,
        },
      });
      const spacingUpdate = maybeCreateAutoSpacingUpdate(currentParts, -1);
      if (spacingUpdate) {
        plan.sourceDataUpdates.push(spacingUpdate);
      }
    }
    return plan;
  }

  if (intentSpec.task === "legend_edit") {
    if (intentSpec.parameters?.direction) {
      plan.sourceDataUpdates.push({
        type: "set",
        path: "source_data.legend.legendDirection",
        value: intentSpec.parameters.direction,
      });
    }

    if (intentSpec.parameters?.fontDelta) {
      const current = Number(currentParts?.source_data?.legend?.legendFontSize) || 12;
      plan.sourceDataUpdates.push({
        type: "set",
        path: "source_data.legend.legendFontSize",
        value: clamp(current + Number(intentSpec.parameters.fontDelta), 9, 30),
      });
    }

    if (intentSpec.parameters?.editItems) {
      plan.panelUpdates.push({ type: "expand-section", sectionId: "legend_detail" });
    }

    return plan;
  }

  return plan;
}
