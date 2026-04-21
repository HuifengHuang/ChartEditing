import { resolveParameterSection } from "../specs/parameterSectionRegistry.js";

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
}

function normalizePath(path) {
  const text = String(path || "").trim();
  if (!text) {
    return "";
  }
  return text.startsWith("source_data.") ? text : `source_data.${text}`;
}

function toLabel(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "Field";
  }
  return raw
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferControlType(bindingType) {
  const type = String(bindingType || "").toLowerCase();
  if (type === "number") {
    return "number";
  }
  if (type === "color") {
    return "color";
  }
  if (type === "bool") {
    return "toggle";
  }
  return "text";
}

function inferValueType(controlType) {
  if (controlType === "number" || controlType === "slider") {
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

function createSection(panelUpdates, sectionId, title, priority = "primary") {
  panelUpdates.push({
    type: "create-section",
    payload: {
      sectionId,
      title,
      priority,
      controls: [],
    },
  });
}

function createBindingControl(binding, prefix) {
  const name = String(binding?.name || "").trim();
  if (!name) {
    return null;
  }
  const controlType = inferControlType(binding?.type);
  const valueType = inferValueType(controlType);
  const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  return {
    id: `${prefix}_${safeName}`,
    label: toLabel(name.split(".").pop() || name),
    controlType,
    operationType: "update",
    bindingMode: "single",
    bind: normalizePath(name),
    valueType,
  };
}

function createRecommendationControl(parameterName, recommendation) {
  const presets = asArray(recommendation)
    .map((item, index) => {
      const preset = asObject(item);
      const rawValues = asObject(preset.values);
      const patch = {};
      Object.entries(rawValues).forEach(([path, value]) => {
        patch[normalizePath(path)] = value;
      });
      return {
        id: String(preset.id || `${parameterName}_preset_${index + 1}`),
        label: String(preset.label || `Preset ${index + 1}`),
        patch,
      };
    })
    .filter((preset) => Object.keys(preset.patch).length > 0);

  if (!presets.length) {
    return null;
  }

  return {
    id: `${parameterName.toLowerCase()}_preset_select`,
    label: `${toLabel(parameterName)} Presets`,
    controlType: "preset-select",
    operationType: "update",
    bindingMode: "preset",
    presetOptions: presets,
  };
}

function inferValueTypeFromSample(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) {
    return "color";
  }
  return "string";
}

function buildTableSchema(rows) {
  const list = asArray(rows);
  const sample = asObject(list[0]);
  const keys = Object.keys(sample);
  const finalKeys = keys.length ? keys : ["month", "waitingArea", "corridor"];
  return finalKeys.map((key) => ({
    key,
    label: toLabel(key),
    valueType: inferValueTypeFromSample(sample[key]),
    editable: true,
  }));
}

function buildItemSchema(columns) {
  const schema = {};
  columns.forEach((column) => {
    if (!column?.key) {
      return;
    }
    schema[column.key] = column.valueType === "number" ? "number" : column.valueType === "boolean" ? "boolean" : "string";
  });
  return schema;
}

function createDataTableControl(parameterName, rows) {
  const schema = buildTableSchema(rows);
  return {
    id: `${parameterName.toLowerCase()}_data_table`,
    label: "Data Table",
    controlType: "table",
    operationType: "update",
    bindingMode: "collection",
    targetCollection: "source_data.data",
    rowKey: schema.find((column) => String(column.key).toLowerCase().includes("month"))?.key || schema[0]?.key || "id",
    rowActions: ["add", "remove"],
    schemaSource: "mixed",
    tableSchema: schema,
    itemSchema: buildItemSchema(schema),
    initialValue: asObject(asArray(rows)[0]),
  };
}

function createFixedChartSizeControl() {
  return {
    id: "fixed_chart_size",
    label: "Fixed Chart Size",
    controlType: "toggle",
    operationType: "update",
    bindingMode: "single",
    bind: "source_data.layout.fixedChartSize",
    valueType: "boolean",
  };
}

function dedupeControls(controls) {
  const map = new Map();
  controls.forEach((control) => {
    if (!control?.id) {
      return;
    }
    map.set(control.id, control);
  });
  return Array.from(map.values());
}

function selectAffectedByPolicy(affected, policy, intentTarget) {
  const list = asArray(affected);
  if (policy === "auto-adjust") {
    return [];
  }
  if (policy === "show-affected-controls") {
    return list;
  }
  if (policy === "mixed") {
    if (String(intentTarget || "").toLowerCase() === "data") {
      return list;
    }
    return list.slice(0, 3);
  }
  if (String(intentTarget || "").toLowerCase() === "data") {
    return list;
  }
  return list.slice(0, 3);
}

function appendControls(panelUpdates, sectionId, controls) {
  dedupeControls(controls).forEach((control) => {
    panelUpdates.push({
      type: "insert-control",
      sectionId,
      payload: control,
    });
  });
}

function mapExtractionEntryToControls(entry, parameterName, context) {
  const extractionEntry = asObject(entry);
  const primaryControls = [];
  const detailControls = [];

  const recommendationControl = createRecommendationControl(parameterName, extractionEntry.recommendation);
  if (recommendationControl) {
    primaryControls.push(recommendationControl);
  }

  asArray(extractionEntry.primaryBindings).forEach((binding) => {
    const control = createBindingControl(binding, `${parameterName}_primary`);
    if (control) {
      primaryControls.push(control);
    }
  });

  if (context.expandRequested) {
    asArray(extractionEntry.expand).forEach((binding) => {
      const control = createBindingControl(binding, `${parameterName}_expand`);
      if (control) {
        detailControls.push(control);
      }
    });
  }

  const affectedForControls = selectAffectedByPolicy(
    extractionEntry.affected,
    context.impactPolicy,
    context.intentTarget
  );
  affectedForControls.forEach((binding) => {
    const control = createBindingControl(binding, `${parameterName}_affected`);
    if (control) {
      detailControls.push(control);
    }
  });

  if (Array.isArray(extractionEntry.data)) {
    primaryControls.push(createDataTableControl(parameterName, extractionEntry.data));
    primaryControls.push(createFixedChartSizeControl());
  }

  if (Array.isArray(extractionEntry.input)) {
    extractionEntry.input.forEach((binding) => {
      const normalizedBinding = {
        ...asObject(binding),
        name: `input.${String(binding?.name || "").trim()}`,
      };
      const control = createBindingControl(normalizedBinding, `${parameterName}_input`);
      if (control) {
        primaryControls.push(control);
      }
    });
  }

  return {
    primaryControls: dedupeControls(primaryControls),
    detailControls: dedupeControls(detailControls),
  };
}

function collectSourceDataUpdates(plan, extractionResult, extractionMap) {
  const updatedSourceData = asObject(extractionResult?.updatedSourceData, asObject(extractionResult?.sourceData));
  if (Object.keys(updatedSourceData).length) {
    plan.sourceDataUpdates.push({
      type: "patch",
      patch: {
        source_data: safeClone(updatedSourceData),
      },
    });
  }

  Object.values(asObject(extractionMap)).forEach((entry) => {
    const extractionEntry = asObject(entry);

    if (Array.isArray(extractionEntry.data)) {
      plan.sourceDataUpdates.push({
        type: "set",
        path: "source_data.data",
        value: safeClone(extractionEntry.data),
      });
    }

    if (Array.isArray(extractionEntry.input)) {
      extractionEntry.input.forEach((item) => {
        const name = String(item?.name || "").trim();
        if (!name) {
          return;
        }
        plan.sourceDataUpdates.push({
          type: "set",
          path: normalizePath(`input.${name}`),
          value: Number(item?.value) || 0,
        });
      });
    }
  });
}

function appendPanelUpdates(plan, intentSpec, extractionMap) {
  const intent = asObject(intentSpec);
  const expandRequested = Boolean(intent.expand);
  const target = String(intent.target || "style").toLowerCase();

  Object.entries(asObject(extractionMap)).forEach(([parameterName, entry]) => {
    const sectionConfig = resolveParameterSection(parameterName, target);

    createSection(plan.panelUpdates, sectionConfig.primarySectionId, sectionConfig.primaryTitle, "primary");
    if (expandRequested) {
      createSection(plan.panelUpdates, sectionConfig.detailSectionId, sectionConfig.detailTitle, "detail");
    }

    const { primaryControls, detailControls } = mapExtractionEntryToControls(entry, parameterName, {
      impactPolicy: sectionConfig.impactPolicy,
      expandRequested,
      intentTarget: target,
    });

    appendControls(plan.panelUpdates, sectionConfig.primarySectionId, primaryControls);

    if (detailControls.length) {
      createSection(plan.panelUpdates, sectionConfig.detailSectionId, sectionConfig.detailTitle, "detail");
      appendControls(plan.panelUpdates, sectionConfig.detailSectionId, detailControls);
      plan.panelUpdates.push({
        type: "expand-section",
        sectionId: sectionConfig.detailSectionId,
      });
    }

    plan.panelUpdates.push({
      type: "highlight-section",
      sectionId: sectionConfig.primarySectionId,
    });
  });
}

export function intentToUpdatePlan(intentSpec, extractionResult, currentPanelSpec) {
  void currentPanelSpec;

  const plan = {
    sourceDataUpdates: [],
    panelUpdates: [],
  };

  const extractionMap = asObject(extractionResult?.extractionMap);
  collectSourceDataUpdates(plan, extractionResult, extractionMap);
  appendPanelUpdates(plan, intentSpec, extractionMap);

  return plan;
}
