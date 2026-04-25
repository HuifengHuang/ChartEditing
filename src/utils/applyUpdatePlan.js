import { addItemToCollection, removeItemFromCollection } from "./collectionUtils.js";
import { setValueByPath } from "./pathUtils.js";
import { updatePanelSpec } from "./updatePanelSpec.js";

// 兼容不同运行环境的深拷贝，保证更新过程不污染输入对象。
function safeClone(value) {
  try {
    return structuredClone(value);
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
}

// 执行单条 source_data 更新指令。
function applySourceUpdate(parts, update) {
  if (!update || !update.type) {
    return;
  }

  // 单点写入：按 path 直接覆盖。
  if (update.type === "set" && update.path) {
    setValueByPath(parts, update.path, update.value);
    return;
  }

  // 批量补丁：一次更新多个 path。
  if (update.type === "patch" && update.patch) {
    Object.entries(update.patch).forEach(([path, value]) => {
      setValueByPath(parts, path, value);
    });
    return;
  }

  // 集合新增：向目标集合 push 一条记录。
  if (update.type === "add" && update.targetCollection) {
    addItemToCollection(parts, update.targetCollection, update.value ?? {});
    return;
  }

  // 集合删除：按 matcher 删除记录。
  if (update.type === "remove" && update.targetCollection) {
    removeItemFromCollection(parts, update.targetCollection, update.matcher);
  }
}

// 同时应用 source_data 与 panelSpec 两类更新，返回新的整体状态。
export function applyUpdatePlan(parts, panelSpec, updatePlan) {
  const nextParts = safeClone(parts);
  const sourceDataUpdates = updatePlan?.sourceDataUpdates || [];
  sourceDataUpdates.forEach((update) => applySourceUpdate(nextParts, update));

  const nextPanelSpec = updatePanelSpec(panelSpec, updatePlan?.panelUpdates || []);
  return {
    parts: nextParts,
    panelSpec: nextPanelSpec,
  };
}
