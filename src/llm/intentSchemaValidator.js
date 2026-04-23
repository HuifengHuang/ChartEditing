import { SUPPORTED_INTENT_TASKS, createDefaultIntentSpec } from "../specs/intentSchema.js";

const ACTION_SET = new Set(["update", "add", "remove", "show_panel"]);
const TYPE_SET = new Set(["style", "data"]);
const STRATEGY_SET = new Set(["create", "extend", "reuse"]);
const MAX_INTENT_COUNT = 6;

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

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

  const nestedIntent = asObject(payload.intent, null);
  if (nestedIntent) {
    return [nestedIntent];
  }

  return [payload];
}

export function validateIntentList(rawPayload) {
  const list = normalizeIntentCandidates(rawPayload)
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .slice(0, MAX_INTENT_COUNT)
    .map((item) => validateIntentSpec(item));

  return list.length ? list : [createDefaultIntentSpec()];
}
