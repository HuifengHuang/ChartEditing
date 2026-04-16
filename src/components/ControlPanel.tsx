import type { ChangeEvent } from "react";
import type { ChartConfig } from "../types/chart";

interface ControlPanelProps {
  config: ChartConfig;
  onChange: (partial: Partial<ChartConfig>) => void;
}

export function ControlPanel({ config, onChange }: ControlPanelProps) {
  const handleNumber =
    (key: keyof ChartConfig) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      onChange({ [key]: Number(event.target.value) } as Partial<ChartConfig>);
    };

  const handleText =
    (key: keyof ChartConfig) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      onChange({ [key]: event.target.value } as Partial<ChartConfig>);
    };

  return (
    <section className="panel">
      <h3>Control Panel</h3>

      <label className="form-row">
        <span>chartWidth</span>
        <input
          type="number"
          min={360}
          max={1200}
          value={config.chartWidth}
          onChange={handleNumber("chartWidth")}
        />
      </label>

      <label className="form-row">
        <span>chartHeight</span>
        <input
          type="number"
          min={280}
          max={800}
          value={config.chartHeight}
          onChange={handleNumber("chartHeight")}
        />
      </label>

      <label className="form-row">
        <span>barColor</span>
        <input
          type="color"
          value={config.barColor}
          onChange={handleText("barColor")}
        />
      </label>

      <label className="form-row">
        <span>barGap/padding</span>
        <input
          type="range"
          min={0}
          max={0.8}
          step={0.05}
          value={config.barPadding}
          onChange={handleNumber("barPadding")}
        />
      </label>

      <label className="form-row">
        <span>titleFontSize</span>
        <input
          type="number"
          min={14}
          max={48}
          value={config.titleFontSize}
          onChange={handleNumber("titleFontSize")}
        />
      </label>

      <label className="form-row">
        <span>titleText</span>
        <input
          type="text"
          value={config.titleText}
          onChange={handleText("titleText")}
        />
      </label>
    </section>
  );
}
