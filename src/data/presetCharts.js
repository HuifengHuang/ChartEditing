import mirroredMoodPreset from "./preset_chart.json";
import hospitalityRadarPreset from "./preset_chart_hospitality_radar.json";
import brickFacadeRadarPreset from "./preset_chart_brick_facade_radar.json";

export const presetCharts = [
  {
    id: "mirrored_mood",
    label: "Patient Mood Scores",
    data: mirroredMoodPreset,
  },
  {
    id: "hospitality_radar",
    label: "Hospitality Gender Radar",
    data: hospitalityRadarPreset,
  },
  {
    id: "brick_facade_radar",
    label: "Brick Facade Radar",
    data: brickFacadeRadarPreset,
  },
];

export const defaultPresetId = presetCharts[0]?.id || "mirrored_mood";

export function resolvePresetById(presetId) {
  const normalizedPresetId = String(presetId || "").trim();
  const matchedPreset = presetCharts.find((item) => item.id === normalizedPresetId);
  return matchedPreset || presetCharts[0];
}
