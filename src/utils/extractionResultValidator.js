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

function pickSourceData(result, base) {
  if (result.sourceData && typeof result.sourceData === "object" && !Array.isArray(result.sourceData)) {
    return result.sourceData;
  }
  if (result.updatedSourceData && typeof result.updatedSourceData === "object" && !Array.isArray(result.updatedSourceData)) {
    return result.updatedSourceData;
  }
  return base;
}

function pickRenderCode(result, base) {
  if (typeof result.renderCode === "string") {
    return result.renderCode;
  }
  if (typeof result.updatedRenderCode === "string") {
    return result.updatedRenderCode;
  }
  return base;
}

export function validateExtractionResult(rawResult, parts) {
  const base = createDefaultExtractionResult(parts);
  const result = asObject(rawResult);

  return {
    sourceData: safeClone(asObject(pickSourceData(result, base.sourceData), base.sourceData)),
    renderCode: pickRenderCode(result, base.renderCode),
    extractionMap: safeClone(asObject(result.extractionMap)),
    bindingMap: safeClone(asObject(result.bindingMap, base.bindingMap)),
    codePatches: Array.isArray(result.codePatches) ? safeClone(result.codePatches) : safeClone(base.codePatches),
  };
}
