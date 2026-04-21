import {
  INTENT_ACTIONS,
  INTENT_PARAMETER_VALUES,
  INTENT_TARGETS,
  createDefaultIntentSpec,
} from "../specs/intentSchema.js";

const TARGET_SET = new Set(INTENT_TARGETS);
const ACTION_SET = new Set(INTENT_ACTIONS);
const PARAMETER_VALUE_SET = new Set(INTENT_PARAMETER_VALUES);

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function normalizeParameterValue(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "recommendation") {
    return "Recommendation";
  }
  if (raw === "preset") {
    return "Preset";
  }
  if (raw === "none") {
    return "None";
  }
  return null;
}

function normalizeParameters(rawParameters) {
  const source = asObject(rawParameters);
  const normalized = {};

  Object.entries(source).forEach(([key, value]) => {
    const normalizedValue = normalizeParameterValue(value);
    if (!normalizedValue) {
      return;
    }
    const cleanedKey = String(key || "").trim();
    if (!cleanedKey) {
      return;
    }
    normalized[cleanedKey] = normalizedValue;
  });

  return normalized;
}

function pickTargetFromLegacy(intent) {
  const rawTarget = intent?.target;
  if (typeof rawTarget === "string" && TARGET_SET.has(rawTarget)) {
    return rawTarget;
  }

  const list = Array.isArray(rawTarget) ? rawTarget.map((item) => String(item || "").toLowerCase()) : [];
  if (list.includes("data")) {
    return "data";
  }
  if (list.some((item) => item === "style" || item === "layout" || item === "legend" || item === "theme")) {
    return "style";
  }
  if (list.includes("other")) {
    return "other";
  }

  if (intent?.intentType === "data") {
    return "data";
  }
  if (intent?.intentType === "style") {
    return "style";
  }
  return "style";
}

function convertLegacyIntent(rawIntent, base) {
  const intent = asObject(rawIntent);
  if ("User_prompt" in intent || "expand" in intent) {
    return null;
  }

  const task = String(intent.task || "").toLowerCase();
  const legacyAction = String(intent.action || "").toLowerCase();
  const action = legacyAction === "add" || legacyAction === "remove" ? legacyAction : "update";
  const expand = Boolean(intent.detailRequested) || intent.panelStrategy === "extend";
  const parameters = {};

  if (task === "color_theme") {
    parameters.color_theme = "Recommendation";
  } else if (task === "aspect_ratio") {
    parameters.aspect_ratio = "Preset";
  } else if (task === "element_edit") {
    parameters.data_edit = "Preset";
  } else if (task === "legend_edit") {
    parameters.legend_style = "Preset";
  }

  const target = pickTargetFromLegacy(intent);
  const promptText = String(intent.User_prompt || intent.user_prompt || intent.prompt || "");

  return {
    ...base,
    User_prompt: promptText,
    target,
    action,
    expand,
    parameters,
  };
}

function normalizeUploadSpecialCase(intent) {
  const normalized = { ...intent };
  const inputValue = normalized.parameters?.Input || normalized.parameters?.input;
  if (normalizeParameterValue(inputValue) === "None") {
    normalized.target = "other";
    normalized.action = "add";
    normalized.expand = false;
    normalized.parameters = { Input: "None" };
  }
  return normalized;
}

export function validateIntentSpec(rawIntent) {
  const base = createDefaultIntentSpec();
  const legacy = convertLegacyIntent(rawIntent, base);
  const source = legacy || asObject(rawIntent);

  const User_prompt = String(source.User_prompt || source.user_prompt || source.prompt || "");
  const target = TARGET_SET.has(source.target) ? source.target : base.target;
  const action = ACTION_SET.has(source.action) ? source.action : base.action;
  const expand = typeof source.expand === "boolean" ? source.expand : base.expand;
  const parameters = normalizeParameters(source.parameters);

  let intent = {
    ...base,
    User_prompt,
    target,
    action,
    expand,
    parameters,
  };

  intent = normalizeUploadSpecialCase(intent);

  const safeParameters = {};
  Object.entries(intent.parameters).forEach(([key, value]) => {
    if (PARAMETER_VALUE_SET.has(value)) {
      safeParameters[key] = value;
    }
  });
  intent.parameters = safeParameters;

  return intent;
}

