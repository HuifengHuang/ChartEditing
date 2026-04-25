// LLM 代理配置：统一从环境变量读取，未配置时使用本地默认值。
export const llmConfig = {
  endpoint: import.meta.env.VITE_INTENT_PROXY_ENDPOINT || "/api/intent-parse",
  timeoutMs: Number(import.meta.env.VITE_INTENT_TIMEOUT_MS || 30000),
};
