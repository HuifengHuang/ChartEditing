export interface ChartDatum {
  category: string;
  value: number;
}

export interface ChartConfig {
  chartWidth: number;
  chartHeight: number;
  barColor: string;
  barPadding: number;
  titleFontSize: number;
  titleText: string;
}

// Reserved for future architecture extension.
export type ChartIR = unknown;
export type EditIntent = unknown;
export type PanelSpec = unknown;
export type PatchPlan = unknown;
