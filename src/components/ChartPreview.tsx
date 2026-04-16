import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ChartConfig, ChartDatum } from "../types/chart";

interface ChartPreviewProps {
  data: ChartDatum[];
  config: ChartConfig;
}

export function ChartPreview({ data, config }: ChartPreviewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const margin = { top: 24, right: 20, bottom: 40, left: 48 };
    const innerWidth = config.chartWidth - margin.left - margin.right;
    const innerHeight = config.chartHeight - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand<string>()
      .domain(data.map((item) => item.category))
      .range([0, innerWidth])
      .padding(config.barPadding);

    const yMax = d3.max(data, (item) => item.value) ?? 0;
    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    chartGroup
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale));

    chartGroup.append("g").call(d3.axisLeft(yScale).ticks(5));

    chartGroup
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", (d) => xScale(d.category) ?? 0)
      .attr("y", (d) => yScale(d.value))
      .attr("width", xScale.bandwidth())
      .attr("height", (d) => innerHeight - yScale(d.value))
      .attr("fill", config.barColor);
  }, [data, config]);

  return (
    <section className="preview">
      <h2 style={{ fontSize: `${config.titleFontSize}px` }}>{config.titleText}</h2>
      <svg ref={svgRef} width={config.chartWidth} height={config.chartHeight} />
    </section>
  );
}
