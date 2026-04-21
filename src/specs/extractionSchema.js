/**
 * @typedef {Object} ExtractionResult
 * @property {Record<string, any>} sourceData
 * @property {string} renderCode
 * @property {Record<string, any>} extractionMap
 * @property {Record<string, any>=} bindingMap
 * @property {Array<any>=} codePatches
 */

export function createDefaultExtractionResult(parts) {
  return {
    sourceData: parts?.source_data && typeof parts.source_data === "object" ? parts.source_data : {},
    renderCode: typeof parts?.render_code === "string" ? parts.render_code : "",
    extractionMap: {},
    bindingMap: {},
    codePatches: [],
  };
}
