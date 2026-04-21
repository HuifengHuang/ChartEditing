import { createDefaultExtractionResult } from "../specs/extractionSchema.js";

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
}

export function validateExtractionResult(rawResult, parts) {
  const base = createDefaultExtractionResult(parts);
  const result = asObject(rawResult);
  return {
    sourceData: safeClone(asObject(result.sourceData, base.sourceData)),
    renderCode: typeof result.renderCode === "string" ? result.renderCode : base.renderCode,
    extractionMap: safeClone(asObject(result.extractionMap)),
    bindingMap: safeClone(asObject(result.bindingMap, base.bindingMap)),
    codePatches: Array.isArray(result.codePatches) ? safeClone(result.codePatches) : safeClone(base.codePatches),
  };
}
