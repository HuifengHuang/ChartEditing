import { addItemToCollection, removeItemFromCollection } from "./collectionUtils.js";
import { setValueByPath } from "./pathUtils.js";
import { updatePanelSpec } from "./updatePanelSpec.js";

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
}

function applySourceUpdate(parts, update) {
  if (!update || !update.type) {
    return;
  }

  if (update.type === "set" && update.path) {
    setValueByPath(parts, update.path, update.value);
    return;
  }

  if (update.type === "patch" && update.patch) {
    Object.entries(update.patch).forEach(([path, value]) => {
      setValueByPath(parts, path, value);
    });
    return;
  }

  if (update.type === "add" && update.targetCollection) {
    addItemToCollection(parts, update.targetCollection, update.value ?? {});
    return;
  }

  if (update.type === "remove" && update.targetCollection) {
    removeItemFromCollection(parts, update.targetCollection, update.matcher);
  }
}

export function applyUpdatePlan(parts, panelSpec, updatePlan, extractionResult = null) {
  const nextParts = safeClone(parts);

  const latestSourceData =
    extractionResult?.updatedSourceData && typeof extractionResult.updatedSourceData === "object"
      ? extractionResult.updatedSourceData
      : extractionResult?.sourceData && typeof extractionResult.sourceData === "object"
        ? extractionResult.sourceData
        : null;

  const latestRenderCode =
    typeof extractionResult?.updatedRenderCode === "string"
      ? extractionResult.updatedRenderCode
      : typeof extractionResult?.renderCode === "string"
        ? extractionResult.renderCode
        : null;

  if (latestSourceData) {
    nextParts.source_data = safeClone(latestSourceData);
  }
  if (latestRenderCode !== null) {
    nextParts.render_code = latestRenderCode;
  }

  const sourceDataUpdates = updatePlan?.sourceDataUpdates || [];
  sourceDataUpdates.forEach((update) => applySourceUpdate(nextParts, update));

  const nextPanelSpec = updatePanelSpec(panelSpec, updatePlan?.panelUpdates || []);
  return {
    parts: nextParts,
    panelSpec: nextPanelSpec,
  };
}
