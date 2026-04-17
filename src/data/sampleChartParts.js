const sampleChartPartsTemplate = {
  import_script: '<script src="https://cdn.jsdelivr.net/npm/d3@7"><\/script>',
  body: '<div id="chart-root"><h2 id="chart-title"></h2><svg id="chart"></svg></div>',
  css: `
    body {
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #ffffff;
      color: #111827;
    }

    #chart-root {
      width: fit-content;
      margin: 16px auto;
      padding: 8px 12px 16px;
      border-radius: 10px;
    }

    #chart-title {
      margin: 0 0 8px;
      text-align: center;
      font-weight: 600;
    }

    svg {
      display: block;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #ffffff;
    }
  `,
  source_data: {
    chartWidth: 640,
    chartHeight: 380,
    fixedChartSize: false,
    barColor: "#2563eb",
    barGap: 0.2,
    titleFontSize: 24,
    titleText: "Sample Bar Chart",
    titleColor: "#0f172a",
    backgroundColor: "#ffffff",
    data: [
      { category: "A", value: 42 },
      { category: "B", value: 68 },
      { category: "C", value: 30 },
      { category: "D", value: 54 },
      { category: "E", value: 76 },
    ],
    meta: {
      tableOrientation: "row-major",
      aspectRatioPreset: "16:9",
    },
    legend: {
      textSize: 12,
      direction: "horizontal",
      items: [
        { id: "bars", label: "Bars", color: "#2563eb" },
        { id: "reference", label: "Reference", color: "#6b7280" },
      ],
    },
  },
  render_code: `
function renderChart(source_data) {
  const chartWidth = Number(source_data.chartWidth) || 640;
  const chartHeight = Number(source_data.chartHeight) || 380;
  const barColor = source_data.barColor || "#2563eb";
  const barGap = Number(source_data.barGap) || 0;
  const titleFontSize = Number(source_data.titleFontSize) || 24;
  const titleText = source_data.titleText || "Sample Bar Chart";
  const titleColor = source_data.titleColor || "#0f172a";
  const backgroundColor = source_data.backgroundColor || "#ffffff";
  const data = Array.isArray(source_data.data) ? source_data.data : [];

  const margin = { top: 56, right: 24, bottom: 48, left: 52 };
  const width = Math.max(chartWidth - margin.left - margin.right, 80);
  const height = Math.max(chartHeight - margin.top - margin.bottom, 80);
  const safeGap = Math.min(0.9, Math.max(0, barGap));

  const root = d3.select("#chart-root");
  root.style("background", backgroundColor);
  root
    .select("#chart-title")
    .text(titleText)
    .style("font-size", titleFontSize + "px")
    .style("color", titleColor);

  const svg = root.select("#chart").attr("width", chartWidth).attr("height", chartHeight);
  svg.selectAll("*").remove();

  const x = d3
    .scaleBand()
    .domain(data.map(function(d) { return d.category; }))
    .range([margin.left, margin.left + width])
    .padding(safeGap);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, function(d) { return d.value; }) || 0])
    .nice()
    .range([margin.top + height, margin.top]);

  svg
    .append("g")
    .attr("transform", "translate(0," + (margin.top + height) + ")")
    .call(d3.axisBottom(x));

  svg
    .append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y));

  svg
    .selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", function(d) { return x(d.category); })
    .attr("y", function(d) { return y(d.value); })
    .attr("width", x.bandwidth())
    .attr("height", function(d) { return y(0) - y(d.value); })
    .attr("fill", barColor);

  const legendConfig = source_data.legend || {};
  const legendItems = Array.isArray(legendConfig.items) && legendConfig.items.length
    ? legendConfig.items
    : [{ id: "bars", label: "Bars", color: barColor }];
  const legendDirection = legendConfig.direction === "vertical" ? "vertical" : "horizontal";
  const legendTextSize = Number(legendConfig.textSize) || 12;
  const legendY = Math.max(18, margin.top - 30);

  const legendGroup = svg.append("g").attr("transform", "translate(" + margin.left + "," + legendY + ")");

  legendItems.forEach(function(item, index) {
    const offsetX = legendDirection === "horizontal" ? index * 120 : 0;
    const offsetY = legendDirection === "horizontal" ? 0 : index * 22;

    const itemGroup = legendGroup
      .append("g")
      .attr("transform", "translate(" + offsetX + "," + offsetY + ")");

    itemGroup
      .append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", item.color || barColor);

    itemGroup
      .append("text")
      .attr("x", 18)
      .attr("y", 10)
      .style("font-size", legendTextSize + "px")
      .style("fill", titleColor)
      .text(item.label || item.id || ("Item " + (index + 1)));
  });
}

renderChart(source_data);
  `.trim(),
};

export function createSampleChartParts() {
  return structuredClone(sampleChartPartsTemplate);
}

export function sourceDataToCode(sourceData) {
  return `const source_data = ${JSON.stringify(sourceData, null, 2)};`;
}
