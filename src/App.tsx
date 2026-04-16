import { useMemo, useState } from "react";
import { ChartPreview } from "./components/ChartPreview";
import { ControlPanel } from "./components/ControlPanel";
import { sampleBarData } from "./data/sampleData";
import type { ChartConfig } from "./types/chart";

const initialConfig: ChartConfig = {
  chartWidth: 720,
  chartHeight: 420,
  barColor: "#3b82f6",
  barPadding: 0.2,
  titleFontSize: 24,
  titleText: "Demo Bar Chart",
};

export default function App() {
  const [config, setConfig] = useState<ChartConfig>(initialConfig);

  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);

  const updateConfig = (partial: Partial<ChartConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  return (
    <div className="layout">
      <main className="left-column">
        <ChartPreview data={sampleBarData} config={config} />
      </main>

      <aside className="right-column">
        <ControlPanel config={config} onChange={updateConfig} />

        <section className="panel">
          <h3>Current Config JSON</h3>
          <pre>{configJson}</pre>
        </section>
      </aside>
    </div>
  );
}
