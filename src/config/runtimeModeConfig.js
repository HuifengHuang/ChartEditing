// 运行模式开关：
// - development: 使用 preset_chart.json，跳过大模型请求以节省成本
// - production: 正常走大模型流程
const rawMode = String(import.meta.env.VITE_APP_MODE || "development").toLowerCase().trim();
const mode = rawMode === "development" ? "development" : "production";

// 开发模式下固定使用的预设图 ID（手动修改这里即可切换预设）
// 可选值示例：
// - mirrored_mood
// - brick_facade_radar
// - us_exports_cuba
// - apple_segments_stacked
const developmentPresetId = "mirrored_mood";

export const runtimeModeConfig = {
  mode,
  isDevelopment: mode === "development",
  isProduction: mode === "production",
  developmentPresetId,
};
