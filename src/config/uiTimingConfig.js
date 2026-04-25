// 前端交互时序配置，集中管理可调延迟参数。
export const uiTimingConfig = {
  chartRebuildDelayMs: Number(import.meta.env.VITE_CHART_REBUILD_DELAY_MS || 3_000),
};
