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
    barColor: "#2563eb",
    barGap: 0.2,
    titleFontSize: 24,
    titleText: "Sample Bar Chart",
    data: [
      { category: "A", value: 42 },
      { category: "B", value: 68 },
      { category: "C", value: 30 },
      { category: "D", value: 54 },
      { category: "E", value: 76 },
    ],
  },
  render_code: `
function renderChart(source_data) {
  const {
    chartWidth,
    chartHeight,
    barColor,
    barGap,
    titleFontSize,
    titleText,
    data,
  } = source_data;

  const margin = { top: 56, right: 24, bottom: 48, left: 52 };
  const width = Math.max(chartWidth - margin.left - margin.right, 80);
  const height = Math.max(chartHeight - margin.top - margin.bottom, 80);
  const safeGap = Math.min(0.9, Math.max(0, Number(barGap) || 0));

  const root = d3.select("#chart-root");
  root
    .select("#chart-title")
    .text(titleText)
    .style("font-size", \`\${titleFontSize}px\`);

  const svg = root.select("#chart").attr("width", chartWidth).attr("height", chartHeight);
  svg.selectAll("*").remove();

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.category))
    .range([margin.left, margin.left + width])
    .padding(safeGap);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) || 0])
    .nice()
    .range([margin.top + height, margin.top]);

  svg
    .append("g")
    .attr("transform", \`translate(0,\${margin.top + height})\`)
    .call(d3.axisBottom(x));

  svg
    .append("g")
    .attr("transform", \`translate(\${margin.left},0)\`)
    .call(d3.axisLeft(y));

  svg
    .selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.category))
    .attr("y", (d) => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", (d) => y(0) - y(d.value))
    .attr("fill", barColor);
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
