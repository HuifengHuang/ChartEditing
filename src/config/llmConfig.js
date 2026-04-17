const MODE_SET = new Set(["rule", "llm", "auto"]);
const PROVIDER_SET = new Set(["mock", "yizhan"]);

function normalizeMode(mode) {
  return MODE_SET.has(mode) ? mode : "auto";
}

function normalizeProvider(provider) {
  return PROVIDER_SET.has(provider) ? provider : "yizhan";
}

export const llmConfig = {
  mode: normalizeMode(import.meta.env.VITE_INTENT_PARSE_MODE || "auto"),
  provider: normalizeProvider(import.meta.env.VITE_INTENT_PROVIDER || "yizhan"),
  endpoint: import.meta.env.VITE_INTENT_PROXY_ENDPOINT || "/api/intent-parse",
  timeoutMs: Number(import.meta.env.VITE_INTENT_TIMEOUT_MS || 30000),
};

export const INTENT_MODES = ["rule", "llm", "auto"];
export const INTENT_PROVIDERS = ["mock", "yizhan"];
