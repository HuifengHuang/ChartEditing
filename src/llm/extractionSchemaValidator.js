import { getValueByPath, setValueByPath } from "../utils/pathUtils.js";

const BINDING_TYPES = new Set(["text", "number", "color", "bool"]);
const FIXED_INPUT_NAMES = ["image-x", "image-y", "image-width", "image-height"];

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

function normalizeName(name) {
  const text = String(name || "").trim();
  if (!text) {
    return "";
  }
  return text.replace(/^source_data\./, "");
}

function normalizeBinding(item, index, sectionName) {
  const entry = asObject(item);
  const name = normalizeName(entry.name);
  if (!name) {
    throw new Error(`Extraction binding ${sectionName}[${index}] missing name.`);
  }

  const type = String(entry.type || "text").toLowerCase();
  if (!BINDING_TYPES.has(type)) {
    throw new Error(`Extraction binding ${sectionName}[${index}] has invalid type.`);
  }

  return {
    name,
    type,
    value: entry.value,
  };
}

function normalizeInputItem(item, index) {
  const entry = asObject(item);
  const name = String(entry.name || "").trim();
  if (!name) {
    throw new Error(`Extraction input[${index}] missing name.`);
  }
  if (String(entry.type || "") !== "number") {
    throw new Error(`Extraction input ${name} must be number type.`);
  }
  const value = Number(entry.value);
  if (!Number.isFinite(value)) {
    throw new Error(`Extraction input ${name} value must be finite number.`);
  }
  return {
    name,
    type: "number",
    value,
  };
}

function ensureBindingNamesInSource(sourceData, extractionMap) {
  Object.values(extractionMap).forEach((parameterEntry) => {
    const entry = asObject(parameterEntry);
    ["primaryBindings", "expand", "affected"].forEach((key) => {
      asArray(entry[key]).forEach((binding) => {
        const path = normalizeName(binding?.name);
        if (!path) {
          return;
        }
        if (getValueByPath(sourceData, path) === undefined) {
          setValueByPath(sourceData, path, binding?.value ?? null);
        }
      });
    });

    asArray(entry.input).forEach((inputEntry) => {
      const name = String(inputEntry?.name || "").trim();
      if (!name) {
        return;
      }
      const path = `input.${name}`;
      if (getValueByPath(sourceData, path) === undefined) {
        setValueByPath(sourceData, path, Number(inputEntry?.value) || 0);
      }
    });
  });
}

function normalizeExtractionEntry(rawEntry) {
  const entry = asObject(rawEntry);
  const normalized = {};

  if (entry.primaryBindings !== undefined) {
    normalized.primaryBindings = asArray(entry.primaryBindings).map((item, index) =>
      normalizeBinding(item, index, "primaryBindings")
    );
  }

  if (entry.expand !== undefined) {
    normalized.expand = asArray(entry.expand).map((item, index) =>
      normalizeBinding(item, index, "expand")
    );
  }

  if (entry.affected !== undefined) {
    normalized.affected = asArray(entry.affected).map((item, index) =>
      normalizeBinding(item, index, "affected")
    );
  }

  if (entry.data !== undefined) {
    const rows = asArray(entry.data);
    normalized.data = rows.map((row) => asObject(row));
  }

  if (entry.input !== undefined) {
    const inputItems = asArray(entry.input).map((item, index) => normalizeInputItem(item, index));
    const names = new Set(inputItems.map((item) => item.name));
    const missing = FIXED_INPUT_NAMES.filter((name) => !names.has(name));
    if (missing.length) {
      throw new Error(`Extraction input must contain fixed fields: ${FIXED_INPUT_NAMES.join(", ")}.`);
    }
    normalized.input = inputItems;
  }

  if (entry.recommendation !== undefined) {
    const recommendation = asArray(entry.recommendation);
    if (recommendation.length < 3) {
      throw new Error("Extraction recommendation must contain at least 3 presets.");
    }
    normalized.recommendation = recommendation.map((item) => asObject(item));
  }

  return normalized;
}

export function validateExtractionLLMResult(rawResult, fallbackParts) {
  const sourceFallback = asObject(fallbackParts?.source_data);
  const renderFallback = typeof fallbackParts?.render_code === "string" ? fallbackParts.render_code : "";

  const root = asObject(rawResult);
  const updatedSourceData = asObject(root.updatedSourceData, asObject(root.sourceData, sourceFallback));
  const updatedRenderCode =
    typeof root.updatedRenderCode === "string"
      ? root.updatedRenderCode
      : typeof root.renderCode === "string"
        ? root.renderCode
        : renderFallback;

  if (!updatedRenderCode) {
    throw new Error("Extraction result missing updatedRenderCode.");
  }

  const rawExtractionMap = asObject(root.extractionMap);
  const extractionMap = {};
  Object.entries(rawExtractionMap).forEach(([parameterName, parameterEntry]) => {
    extractionMap[String(parameterName)] = normalizeExtractionEntry(parameterEntry);
  });

  const nextSourceData = safeClone(updatedSourceData);
  ensureBindingNamesInSource(nextSourceData, extractionMap);

  return {
    sourceData: nextSourceData,
    renderCode: updatedRenderCode,
    extractionMap,
    bindingMap: asObject(root.bindingMap),
    codePatches: asArray(root.codePatches),
    updatedSourceData: nextSourceData,
    updatedRenderCode,
  };
}
