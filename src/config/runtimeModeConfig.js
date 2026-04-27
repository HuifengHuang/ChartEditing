// 运行模式开关：
// - development: 使用 preset_chart.json，跳过大模型请求以节省成本
// - production: 正常走大模型流程
const rawMode = String(import.meta.env.VITE_APP_MODE || "production").toLowerCase().trim();
const mode = rawMode === "development" ? "development" : "production";

export const runtimeModeConfig = {
  mode,
  isDevelopment: mode === "development",
  isProduction: mode === "production",
};
