import { getValueByPath } from "./pathUtils.js";

function safeString(value) {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function isColorString(value) {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function normalizeType(rawType, rawValue) {
  const type = safeString(rawType).toLowerCase();
  if (type.includes("array") || type.includes("list") || Array.isArray(rawValue)) {
    return { controlType: "table", valueType: "array" };
  }
  if (type.includes("color")) {
    return { controlType: "color", valueType: "color" };
  }
  if (
    type.includes("number") ||
    type.includes("int") ||
    type.includes("float") ||
    type.includes("size")
  ) {
    return { controlType: "number", valueType: "number" };
  }
  if (type.includes("bool")) {
    return { controlType: "toggle", valueType: "boolean" };
  }

  if (typeof rawValue === "number") {
    return { controlType: "number", valueType: "number" };
  }
  if (typeof rawValue === "boolean") {
    return { controlType: "toggle", valueType: "boolean" };
  }
  if (isColorString(rawValue)) {
    return { controlType: "color", valueType: "color" };
  }
  if (rawValue && typeof rawValue === "object") {
    return { controlType: "text", valueType: "object" };
  }

  return { controlType: "text", valueType: "string" };
}

function normalizeValue(value, valueType) {
  if (valueType === "number") {
    const n = typeof value === "string" ? parseFloat(value) : Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (valueType === "color") {
    const text = safeString(value);
    return isColorString(text) ? text : "#000000";
  }
  if (valueType === "boolean") {
    return Boolean(value);
  }
  if (valueType === "array") {
    return Array.isArray(value) ? safeClone(value) : [];
  }
  if (valueType === "object") {
    return value && typeof value === "object" ? safeClone(value) : {};
  }
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : String(value);
}

function toControlId(prefix, path, index) {
  const pathKey = safeString(path)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${prefix}_${pathKey || `item_${index + 1}`}`;
}

function detectValueType(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (isColorString(value)) {
    return "color";
  }
  return "string";
}

function inferTableSchema(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return [];
  }

  const objectRows = rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  if (!objectRows.length) {
    return [];
  }

  const keys = [];
  const keySet = new Set();
  objectRows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (keySet.has(key)) {
        return;
      }
      keySet.add(key);
      keys.push(key);
    });
  });

  return keys.map((key) => {
    const sample = objectRows.find((row) => row?.[key] !== undefined)?.[key];
    return {
      key,
      label: key,
      valueType: detectValueType(sample),
      editable: true,
    };
  });
}

function inferRowKey(rows, schema) {
  const objectRows = rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  if (!objectRows.length) {
    return "";
  }

  const candidates = ["id", "month", "name", "label", "key"];
  const schemaKeys = schema.map((column) => column.key);
  const firstCandidate = candidates.find((key) => schemaKeys.includes(key));
  if (firstCandidate) {
    return firstCandidate;
  }
  return schemaKeys[0] || "";
}

function buildTableInitialValue(schema, rows) {
  if (!schema.length) {
    return {};
  }

  const first = rows.find((row) => row && typeof row === "object" && !Array.isArray(row));
  if (first) {
    return safeClone(first);
  }

  const initial = {};
  schema.forEach((column) => {
    if (column.valueType === "number") {
      initial[column.key] = 0;
    } else if (column.valueType === "boolean") {
      initial[column.key] = false;
    } else if (column.valueType === "color") {
      initial[column.key] = "#000000";
    } else {
      initial[column.key] = "";
    }
  });
  return initial;
}

function resolveItemValue(item, chartParts) {
  if (item && Object.prototype.hasOwnProperty.call(item, "value")) {
    return item.value;
  }
  const path = safeString(item?.path);
  if (!path || !chartParts) {
    return undefined;
  }
  return getValueByPath(chartParts, path);
}

function buildArrayTableControl({ item, index, idPrefix, path, title, rows }) {
  const schema = inferTableSchema(rows);
  const rowKey = inferRowKey(rows, schema);
  if (!schema.length || !rowKey) {
    return null;
  }

  const control = {
    id: toControlId(idPrefix, path, index),
    label: title || path,
    controlType: "table",
    operationType: "update",
    bindingMode: "collection",
    targetCollection: path,
    rowKey,
    rowActions: ["add", "remove"],
    schemaSource: "mixed",
    tableOrientation: "auto",
    tableSchema: schema,
    initialValue: buildTableInitialValue(schema, rows),
  };

  if (item?.reason) {
    control.warningMessage = safeString(item.reason);
  }

  return control;
}

function buildArrayPrimitiveControls({ item, index, idPrefix, path, title, rows }) {
  const limit = Math.min(rows.length, 24);
  const controls = [];
  for (let i = 0; i < limit; i += 1) {
    const rawValue = rows[i];
    const mapped = normalizeType("", rawValue);
    controls.push({
      id: toControlId(`${idPrefix}_${i}`, `${path}.${i}`, index),
      label: `${title}[${i}]`,
      controlType: mapped.controlType === "table" ? "text" : mapped.controlType,
      operationType: "update",
      bindingMode: "single",
      bind: `${path}.${i}`,
      valueType: mapped.valueType === "array" ? "string" : mapped.valueType,
      defaultValue: normalizeValue(rawValue, mapped.valueType === "array" ? "string" : mapped.valueType),
    });
  }
  return controls;
}

function buildControlsByItem({ item, index, idPrefix, chartParts }) {
  const path = safeString(item?.path);
  if (!path) {
    return [];
  }

  const title = safeString(item?.title || item?.name || path);
  const resolvedValue = resolveItemValue(item, chartParts);
  const { controlType, valueType } = normalizeType(item?.type, resolvedValue);

  if (valueType === "array" && Array.isArray(resolvedValue)) {
    const tableControl = buildArrayTableControl({
      item,
      index,
      idPrefix,
      path,
      title,
      rows: resolvedValue,
    });
    if (tableControl) {
      return [tableControl];
    }
    return buildArrayPrimitiveControls({
      item,
      index,
      idPrefix,
      path,
      title,
      rows: resolvedValue,
    });
  }

  const control = {
    id: toControlId(idPrefix, path, index),
    label: title || path,
    controlType,
    operationType: "update",
    bindingMode: "single",
    bind: path,
    valueType,
    defaultValue: normalizeValue(resolvedValue, valueType),
  };

  if (item?.reason) {
    control.warningMessage = safeString(item.reason);
  }

  return [control];
}

function buildSourceDataUpdatesFromItems(items, chartParts) {
  const updates = [];
  const seen = new Set();

  items.forEach((item) => {
    const path = safeString(item?.path);
    if (!path || seen.has(path)) {
      return;
    }
    seen.add(path);

    const value = resolveItemValue(item, chartParts);
    if (value === undefined) {
      return;
    }
    const mapped = normalizeType(item?.type, value);
    updates.push({
      type: "set",
      path,
      value: normalizeValue(value, mapped.valueType),
    });
  });

  return updates;
}

function collectOriginPatchPaths(presets, subPanelItems) {
  const set = new Set();
  presets.forEach((preset) => {
    safeArray(preset?.values).forEach((item) => {
      const path = safeString(item?.path);
      if (path) {
        set.add(path);
      }
    });
  });
  subPanelItems.forEach((item) => {
    const path = safeString(item?.path);
    if (path) {
      set.add(path);
    }
  });
  return Array.from(set);
}

function buildOriginPresetOption({ topPanel, presets, subPanelItems, chartParts }) {
  const options = safeArray(topPanel?.options).map((item) => safeString(item)).filter(Boolean);
  const hasOrigin = options.some((item) => item.toLowerCase() === "origin");
  const originLabel = hasOrigin ? options.find((item) => item.toLowerCase() === "origin") : "origin";

  const patch = {};
  const paths = collectOriginPatchPaths(presets, subPanelItems);
  paths.forEach((path) => {
    const currentValue = getValueByPath(chartParts, path);
    if (currentValue !== undefined) {
      patch[path] = safeClone(currentValue);
    }
  });

  return {
    id: "origin",
    label: originLabel || "origin",
    patch,
  };
}

function buildPresetControl(recommendationJson, panelJson, chartParts, subPanelItems) {
  const presets = safeArray(recommendationJson?.presets);
  if (!presets.length) {
    return null;
  }

  const topPanel = safeObject(panelJson?.["top-panel"]);
  const topTitle = safeString(topPanel.title) || "Recommendation Presets";
  const recommendationRequired = recommendationJson?.recommendationRequired === true;
  const presetOptions = presets
    .map((preset, index) => {
      const values = safeArray(preset?.values);
      const patch = {};
      values.forEach((item) => {
        const path = safeString(item?.path);
        if (!path) {
          return;
        }
        const mappedType = normalizeType(item?.type, item?.value);
        patch[path] = normalizeValue(item?.value, mappedType.valueType);
      });
      if (!Object.keys(patch).length) {
        return null;
      }
      return {
        id: safeString(preset?.id) || `preset_${index + 1}`,
        label: safeString(preset?.label) || `Preset ${index + 1}`,
        patch,
      };
    })
    .filter(Boolean);

  if (recommendationRequired) {
    presetOptions.unshift(
      buildOriginPresetOption({
        topPanel,
        presets,
        subPanelItems,
        chartParts,
      })
    );
  }

  if (!presetOptions.length) {
    return null;
  }

  return {
    id: "recommendation_preset_select",
    label: topTitle,
    description: "Apply recommended style preset generated by model.",
    controlType: "preset-select",
    operationType: "update",
    bindingMode: "preset",
    presetOptions,
  };
}

function dedupeByPath(items) {
  const seen = new Set();
  return items.filter((item) => {
    const path = safeString(item?.path);
    if (!path || seen.has(path)) {
      return false;
    }
    seen.add(path);
    return true;
  });
}

function resolveSubPanelItems(recommendationJson, panelJson) {
  const fromPanelOutput = safeArray(panelJson?.["sub-panel"]);
  if (fromPanelOutput.length) {
    return dedupeByPath(fromPanelOutput);
  }
  const fromPanelInput = safeArray(recommendationJson?.structure?.attributes);
  return dedupeByPath(fromPanelInput);
}

function resolveAffectedItems(recommendationJson, panelJson) {
  const fromPanelOutput = safeArray(panelJson?.["affected-panel"]);
  if (fromPanelOutput.length) {
    return dedupeByPath(fromPanelOutput);
  }
  const fromPanelInput = safeArray(recommendationJson?.structure?.affected);
  return dedupeByPath(fromPanelInput);
}

function createSection(sectionId, title, priority = "primary") {
  return {
    type: "create-section",
    payload: {
      sectionId,
      title,
      priority,
      controls: [],
    },
  };
}

export function buildRecommendationPanelPlan({ recommendationJson, panelJson, chartParts }) {
  const safeRecommendation = safeObject(recommendationJson);
  const safePanelJson = safeObject(panelJson);
  const recommendationRequired = safeRecommendation?.recommendationRequired === true;

  const subPanelItems = resolveSubPanelItems(safeRecommendation, safePanelJson);
  const affectedItems = resolveAffectedItems(safeRecommendation, safePanelJson);
  const presetControl = buildPresetControl(safeRecommendation, safePanelJson, chartParts, subPanelItems);

  const panelUpdates = [];
  const sourceDataUpdates = recommendationRequired ? [] : buildSourceDataUpdatesFromItems(subPanelItems, chartParts);

  if (presetControl) {
    panelUpdates.push(createSection("recommendation_presets", "Recommendation Presets", "primary"));
    panelUpdates.push({
      type: "insert-control",
      sectionId: "recommendation_presets",
      payload: presetControl,
    });
  }

  if (subPanelItems.length) {
    panelUpdates.push(createSection("recommendation_sub_panel", "Recommendation Controls", "primary"));
    subPanelItems.forEach((item, index) => {
      const controls = buildControlsByItem({ item, index, idPrefix: "recommendation_sub", chartParts });
      controls.forEach((control) => {
        panelUpdates.push({
          type: "insert-control",
          sectionId: "recommendation_sub_panel",
          payload: control,
        });
      });
    });
  }

  if (affectedItems.length) {
    panelUpdates.push(createSection("recommendation_affected_panel", "Affected Controls", "detail"));
    affectedItems.forEach((item, index) => {
      const controls = buildControlsByItem({
        item,
        index,
        idPrefix: "recommendation_affected",
        chartParts,
      });
      controls.forEach((control) => {
        panelUpdates.push({
          type: "insert-control",
          sectionId: "recommendation_affected_panel",
          payload: control,
        });
      });
    });
    panelUpdates.push({ type: "expand-section", sectionId: "recommendation_affected_panel" });
  }

  return {
    sourceDataUpdates,
    panelUpdates,
  };
}
