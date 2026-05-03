function safeString(value) {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isColorString(value) {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function normalizeType(rawType, rawValue) {
  const type = safeString(rawType).toLowerCase();
  if (
    type.includes("number") ||
    type.includes("int") ||
    type.includes("float") ||
    type.includes("size")
  ) {
    return "number";
  }
  if (type.includes("bool")) {
    return "boolean";
  }
  if (type.includes("color")) {
    return "color";
  }
  if (type.includes("array") || type.includes("list") || Array.isArray(rawValue)) {
    return "array";
  }
  if (rawValue && typeof rawValue === "object") {
    return "object";
  }
  if (typeof rawValue === "number") {
    return "number";
  }
  if (typeof rawValue === "boolean") {
    return "boolean";
  }
  if (isColorString(rawValue)) {
    return "color";
  }
  return "string";
}

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function normalizeValue(value, valueType) {
  if (valueType === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (valueType === "boolean") {
    return Boolean(value);
  }
  if (valueType === "color") {
    const text = safeString(value);
    return isColorString(text) ? text : "#000000";
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

export function extractDesignPresetsFromRecommendation(recommendationJson, maxCount = 3) {
  const presets = safeArray(recommendationJson?.presets);
  return presets
    .slice(0, Math.max(0, maxCount))
    .map((preset, index) => {
      const patch = {};
      safeArray(preset?.values).forEach((item) => {
        const path = safeString(item?.path);
        if (!path) {
          return;
        }
        const valueType = normalizeType(item?.type, item?.value);
        patch[path] = normalizeValue(item?.value, valueType);
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
}
