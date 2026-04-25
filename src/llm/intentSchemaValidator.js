import { SUPPORTED_INTENT_TASKS, createDefaultIntentSpec } from "../specs/intentSchema.js";

const ACTION_SET = new Set(["update", "add", "remove", "show_panel"]);
const TYPE_SET = new Set(["style", "data"]);
const STRATEGY_SET = new Set(["create", "extend", "reuse"]);
const MAX_INTENT_COUNT = 6;

// 安全转换为对象。
function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

// 安全转换为数组。
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// 从 attributes / affected 中收集 path，供任务推断使用。
function collectPaths(payload) {
  const items = [...asArray(payload.attributes), ...asArray(payload.affected)];
  return items
    .map((item) => asObject(item, null))
    .filter(Boolean)
    .map((item) => String(item.path || "").trim())
    .filter(Boolean);
}

// 根据 target + path 推断任务类型。
function inferTaskByPathAndTarget(payload) {
  const targetText = String(payload.target || "").toLowerCase();
  const paths = collectPaths(payload).map((path) => path.toLowerCase());

  const hasPath = (pattern) => paths.some((path) => pattern.test(path));
  const hasTarget = (keywords) => keywords.some((word) => targetText.includes(word));
  const hasLegendStructurePath = () =>
    paths.some((path) => /^source_data\.legend(?:\.|$)/.test(path) || /^legend(?:\.|$)/.test(path));
  const hasStyleLegendPath = () => paths.some((path) => /^source_data\.styles\.legend(?:\.|$)/.test(path));

  // 仅当命中真实 legend 结构字段时才归类为 legend_edit，
  // 避免 source_data.styles.legend.* 误触发 Legend 控件组。
  if (hasLegendStructurePath() || (hasTarget(["legend", "图例"]) && !hasStyleLegendPath())) {
    return "legend_edit";
  }
  if (hasPath(/(^|\.)(data)(\.|$)/) || hasTarget(["data", "数据", "表格"])) {
    return "element_edit";
  }
  if (
    hasPath(/aspect|ratio|layout|width|height|charttop|rowgap|maxbarwidth|titley|subtitley/) ||
    hasTarget(["layout", "布局", "尺寸", "宽", "高"])
  ) {
    return "aspect_ratio";
  }
  if (hasPath(/style|styles|color|fill|font|theme/) || hasTarget(["style", "样式", "颜色", "主题"])) {
    return "color_theme";
  }
  return "color_theme";
}

// 推断动作类型。
function inferAction(payload) {
  const text = `${payload.intent || ""} ${payload.target || ""}`.toLowerCase();
  if (/(remove|delete|删除|移除)/.test(text)) {
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

// 将“意图分解结构”转换为执行层 intent。
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

// 校验并归一化单个 intent。
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

// 统一候选格式（数组 / {intents} / 单对象）。
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

// 校验并输出 intents 数组。
export function validateIntentList(rawPayload) {
  const list = normalizeIntentCandidates(rawPayload)
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .slice(0, MAX_INTENT_COUNT)
    .map((item) => validateIntentSpec(item));

  return list.length ? list : [createDefaultIntentSpec()];
}
