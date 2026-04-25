import { SUPPORTED_INTENT_TASKS, createDefaultIntentSpec } from "../specs/intentSchema.js";

const ACTION_SET = new Set(["update", "add", "remove", "show_panel"]);
const TYPE_SET = new Set(["style", "data"]);
const STRATEGY_SET = new Set(["create", "extend", "reuse"]);
const MAX_INTENT_COUNT = 6;

// 将任意值安全转为对象；不合法时返回兜底对象。
function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

// 将任意值安全转为数组；不合法时返回空数组。
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// 从 attributes / affected 中提取 path 列表，供任务类型推断使用。
function collectPaths(payload) {
  const items = [...asArray(payload.attributes), ...asArray(payload.affected)];

  return items
    .map((item) => asObject(item, null))
    .filter(Boolean)
    .map((item) => String(item.path || "").trim())
    .filter(Boolean);
}

// 根据 target 文本和 path 关键词，推断任务类型。
function inferTaskByPathAndTarget(payload) {
  const targetText = String(payload.target || "").toLowerCase();
  const paths = collectPaths(payload).map((path) => path.toLowerCase());

  const hasPath = (pattern) => paths.some((path) => pattern.test(path));
  const hasTarget = (keywords) => keywords.some((word) => targetText.includes(word));

  if (hasPath(/legend/) || hasTarget(["legend", "图例"])) {
    return "legend_edit";
  }
  if (hasPath(/(^|\.)(data)(\.|$)/) || hasTarget(["data", "数据", "表格"])) {
    return "element_edit";
  }
  if (
    hasPath(/aspect|ratio|layout|width|height|charttop|rowgap|maxbarwidth|titley|subtitley/) ||
    hasTarget(["layout", "比例", "尺寸", "宽", "高", "间距"])
  ) {
    return "aspect_ratio";
  }
  if (hasPath(/style|styles|color|fill|font|theme/) || hasTarget(["style", "颜色", "配色", "主题"])) {
    return "color_theme";
  }
  return "color_theme";
}

// 根据意图描述文本推断动作类型（增/删/改/仅展示面板）。
function inferAction(payload) {
  const text = `${payload.intent || ""} ${payload.target || ""}`.toLowerCase();
  if (/(remove|delete|删除|去掉)/.test(text)) {
    return "remove";
  }
  if (/(add|append|新增|添加)/.test(text)) {
    return "add";
  }
  if (asArray(payload.attributes).length > 0) {
    return "update";
  }
  return "show_panel";
}

// 将“意图分解结构”（intent/target/attributes/affected）转换为可执行 intent。
function toExecutionIntentFromDecomposePayload(rawPayload) {
  const payload = asObject(rawPayload, {});
  if (!payload || Array.isArray(payload.intents)) {
    return null;
  }

  const hasDecomposeShape =
    "intent" in payload ||
    "target" in payload ||
    Array.isArray(payload.attributes) ||
    Array.isArray(payload.affected);
  if (!hasDecomposeShape) {
    return null;
  }

  const task = inferTaskByPathAndTarget(payload);
  const action = inferAction(payload);
  const intentType = task === "element_edit" ? "data" : "style";
  const targetMap = {
    aspect_ratio: ["layout"],
    color_theme: ["style"],
    element_edit: ["data"],
    legend_edit: ["legend"],
  };

  return {
    intentId: `intent_${Date.now()}`,
    intentType,
    task,
    target: targetMap[task] || ["style"],
    action,
    parameters: {
      decomposeIntent: String(payload.intent || ""),
      decomposeTarget: String(payload.target || ""),
      attributes: asArray(payload.attributes),
      affected: asArray(payload.affected),
    },
    needPanel: true,
    panelStrategy: "reuse",
    detailRequested: false,
  };
}

// 校验并归一化单条 intent，确保后续流程可稳定消费。
export function validateIntentSpec(rawIntent) {
  const base = createDefaultIntentSpec();
  const intent = asObject(rawIntent);

  const task = SUPPORTED_INTENT_TASKS.includes(intent.task) ? intent.task : base.task;
  const action = ACTION_SET.has(intent.action) ? intent.action : "show_panel";
  const intentType = TYPE_SET.has(intent.intentType) ? intent.intentType : base.intentType;
  const panelStrategy = STRATEGY_SET.has(intent.panelStrategy) ? intent.panelStrategy : "reuse";

  return {
    ...base,
    ...intent,
    intentId: String(intent.intentId || `intent_${Date.now()}`),
    task,
    action,
    intentType,
    target: Array.isArray(intent.target) ? intent.target.filter(Boolean).map(String) : base.target,
    parameters: asObject(intent.parameters),
    needPanel: intent.needPanel !== false,
    panelStrategy,
    detailRequested: Boolean(intent.detailRequested),
  };
}

// 兼容多种上游返回结构，统一转换为 intent 数组候选。
function normalizeIntentCandidates(rawPayload) {
  if (Array.isArray(rawPayload)) {
    return rawPayload;
  }

  const payload = asObject(rawPayload, null);
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload.intents)) {
    return payload.intents;
  }

  const executionIntent = toExecutionIntentFromDecomposePayload(payload);
  if (executionIntent) {
    return [executionIntent];
  }

  const nestedIntent = asObject(payload.intent, null);
  if (nestedIntent) {
    return [nestedIntent];
  }

  return [payload];
}

// 校验完整 intent 列表，限制数量并兜底返回默认 intent。
export function validateIntentList(rawPayload) {
  const list = normalizeIntentCandidates(rawPayload)
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .slice(0, MAX_INTENT_COUNT)
    .map((item) => validateIntentSpec(item));

  return list.length ? list : [createDefaultIntentSpec()];
}
