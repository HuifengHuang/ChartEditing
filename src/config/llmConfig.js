export const llmConfig = {
  endpoint: import.meta.env.VITE_INTENT_PROXY_ENDPOINT || "/api/intent-parse",
  timeoutMs: Number(import.meta.env.VITE_INTENT_TIMEOUT_MS || 30000),
};
