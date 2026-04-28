import mirroredMoodPreset from "./preset_chart_mirrored_bar.json";
import brickFacadeRadarPreset from "./preset_chart_brick_facade_radar.json";
import usExportsCubaPreset from "./preset_chart_us_exports_cuba.json";
import appleSegmentsStackedPreset from "./preset_chart_apple_segments_stacked.json";

export const presetCharts = [
  {
    id: "mirrored_mood",
    label: "对称柱状图",
    data: mirroredMoodPreset,
  },
  {
    id: "brick_facade_radar",
    label: "多数据雷达图",
    data: brickFacadeRadarPreset,
  },
  {
    id: "us_exports_cuba",
    label: "线图",
    data: usExportsCubaPreset,
  },
  {
    id: "apple_segments_stacked",
    label: "堆叠图",
    data: appleSegmentsStackedPreset,
  },
];

export const defaultPresetId = presetCharts[0]?.id || "mirrored_mood";

export function resolvePresetById(presetId) {
  const normalizedPresetId = String(presetId || "").trim();
  const matchedPreset = presetCharts.find((item) => item.id === normalizedPresetId);
  return matchedPreset || presetCharts[0];
}
