const sampleChartPartsMirroredMoodTemplate = {
  import_script: '<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>',
  body: `
    <div id="page-wrap">
      <div id="card">
        <svg id="chart" role="img" aria-label="Mirrored horizontal bar chart"></svg>
      </div>
    </div>
  `.trim(),
  css: `
    :root {
      color-scheme: light;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
    }

    #page-wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 18px;
      box-sizing: border-box;
    }

    #card {
      width: fit-content;
      border-radius: 0;
      box-shadow: none;
    }

    svg text {
      font-family: Arial, Helvetica, sans-serif;
    }
  `,
  source_data: {
    layout: {
      svgWidth: 420,
      svgHeight: 520,
      margin: { top: 18, right: 20, bottom: 16, left: 20 },
      chartTop: 54,
      chartBottom: 382,
      barHeight: 19,
      labelGap: 66,
      valuePad: 8,
      rowStep: 27.3,
      fixedChartSize: true,
      titleY: 438,
      subtitleY: 488,
    },
    data: [
      { month: "2023-01", waitingArea: 4.2, corridor: 3.8 },
      { month: "2023-02", waitingArea: 4.5, corridor: 4.1 },
      { month: "2023-03", waitingArea: 5.1, corridor: 4.7 },
      { month: "2023-04", waitingArea: 5.8, corridor: 5.3 },
      { month: "2023-05", waitingArea: 6.2, corridor: 5.9 },
      { month: "2023-06", waitingArea: 6.7, corridor: 6.3 },
      { month: "2023-07", waitingArea: 7.1, corridor: 6.8 },
      { month: "2023-08", waitingArea: 7.5, corridor: 7.2 },
      { month: "2023-09", waitingArea: 7.9, corridor: 7.6 },
      { month: "2023-10", waitingArea: 8.3, corridor: 8.0 },
      { month: "2023-11", waitingArea: 8.6, corridor: 8.3 },
      { month: "2023-12", waitingArea: 8.9, corridor: 8.6 },
    ],
    style: {
      waitingAreaColor: "#c75b4e",
      corridorColor: "#efc45a",
      textMidColor: "#666666",
      textLightColor: "#7a7a7a",
      titleColor: "#3f3f3f",
      subtitleColor: "#808080",
      backgroundColor: "#f3f3f3",
      cardBackgroundColor: "#ffffff",
    },
    legend: {
      legendItems: [
        { id: "waiting", label: "Waiting Area", color: "#c75b4e" },
        { id: "corridor", label: "Corridor", color: "#efc45a" },
      ],
      legendFontSize: 12,
      legendPosition: "top-center",
      legendDirection: "horizontal",
      legendOffsetY: 24,
    },
    title: {
      titleLines: ["Patient Mood Scores Rise After", "Public Art Installation"],
      content: "Average mood scores improve consistently in waiting areas andcorridors through 2023 following public art installations.",
      subtitleLines: [
        "Average mood scores improve consistently in waiting areas and",
        "corridors through 2023 following public art installations.",
      ],
      titleFontSize: 22,
      subtitleFontSize: 12,
    },
    meta: {
      tableOrientation: "row-major",
      aspectRatioPreset: "420x520",
    },
  },
  render_code: `
function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  const withMin = min === undefined ? parsed : Math.max(min, parsed);
  return max === undefined ? withMin : Math.min(max, withMin);
}

function asArray(value, fallback) {
  return Array.isArray(value) ? value : fallback;
}

function asObject(value, fallback) {
  return value && typeof value === "object" ? value : fallback;
}

function formatScore(value) {
  const safe = clampNumber(value, 0, 0, undefined);
  return safe.toFixed(1).replace(/\\.0$/, "");
}

function wrapTextByWords(text, maxCharsPerLine) {
  const normalized = String(text || "").trim().replace(/\\s+/g, " ");
  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ");
  const lines = [];
  let current = "";

  words.forEach(function(word) {
    const next = current ? current + " " + word : word;
    if (next.length <= maxCharsPerLine || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) {
    lines.push(current);
  }
  return lines;
}

function renderChart(source_data) {
  const layout = asObject(source_data.layout, {});
  const style = asObject(source_data.style, {});
  const legend = asObject(source_data.legend, {});
  const title = asObject(source_data.title, {});
  const data = asArray(source_data.data, []);

  const svgWidth = clampNumber(layout.svgWidth, 420, 280, 1200);
  const svgHeight = clampNumber(layout.svgHeight, 520, 320, 1200);
  const margin = Object.assign({ top: 18, right: 20, bottom: 16, left: 20 }, asObject(layout.margin, {}));
  const chartTop = clampNumber(layout.chartTop, 54, 0, svgHeight - 1);
  const chartBottom = clampNumber(layout.chartBottom, 382, chartTop + 40, svgHeight - 1);
  const fixedChartSize = Boolean(layout.fixedChartSize);
  const autoRowStep = (chartBottom - chartTop) / Math.max(data.length, 1);
  const rowStep = fixedChartSize ? autoRowStep : clampNumber(layout.rowStep, autoRowStep, 14, 80);
  const barHeight = clampNumber(layout.barHeight, 19, 6, Math.max(6, rowStep - 2));
  const labelGap = clampNumber(layout.labelGap, 66, 18, svgWidth * 0.5);
  const valuePad = clampNumber(layout.valuePad, 8, 0, 24);
  const titleY = clampNumber(layout.titleY, Math.max(chartBottom + 56, svgHeight - 82), chartBottom + 20, svgHeight - 36);
  const subtitleY = clampNumber(layout.subtitleY, titleY + 50, titleY + 14, svgHeight - 12);

  const waitingAreaColor = style.waitingAreaColor || "#c75b4e";
  const corridorColor = style.corridorColor || "#efc45a";
  const textMidColor = style.textMidColor || "#666666";
  const textLightColor = style.textLightColor || "#7a7a7a";
  const titleColor = style.titleColor || "#3f3f3f";
  const subtitleColor = style.subtitleColor || "#808080";
  const backgroundColor = style.backgroundColor || "#f3f3f3";
  const cardBackgroundColor = style.cardBackgroundColor || "#ffffff";

  const legendItems = asArray(legend.legendItems, [
    { id: "waiting", label: "Waiting Area", color: waitingAreaColor },
    { id: "corridor", label: "Corridor", color: corridorColor },
  ]);
  const legendFontSize = clampNumber(legend.legendFontSize, 12, 9, 24);
  const legendPosition = legend.legendPosition || "top-center";
  const legendDirection = legend.legendDirection === "vertical" ? "vertical" : "horizontal";
  const legendOffsetY = clampNumber(legend.legendOffsetY, 24, 8, 80);

  const titleLines = asArray(title.titleLines, ["Mirrored Mood Chart"]);
  const content = typeof title.content === "string" ? title.content : "";
  const subtitleLines = content.trim()
    ? wrapTextByWords(content, 56)
    : asArray(title.subtitleLines, []);
  const titleFontSize = clampNumber(title.titleFontSize, 22, 10, 48);
  const subtitleFontSize = clampNumber(title.subtitleFontSize, 12, 8, 28);

  const centerX = svgWidth / 2;
  const leftBaseX = centerX - labelGap / 2;
  const rightBaseX = centerX + labelGap / 2;
  const leftOuterX = margin.left + 18;
  const rightOuterX = svgWidth - margin.right - 18;
  const barMaxLen = Math.max(16, Math.min(leftBaseX - leftOuterX - valuePad, rightOuterX - rightBaseX - valuePad));

  const maxValue =
    d3.max(data, function(d) {
      return Math.max(clampNumber(d.waitingArea, 0, 0, undefined), clampNumber(d.corridor, 0, 0, undefined));
    }) || 1;
  const x = d3.scaleLinear().domain([0, maxValue]).range([0, barMaxLen]);

  const wrap = d3.select("#page-wrap").style("background", backgroundColor);
  const card = d3.select("#card").style("background", cardBackgroundColor).style("width", svgWidth + "px");

  const svg = d3
    .select("#chart")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .attr("viewBox", "0 0 " + svgWidth + " " + svgHeight);

  svg.selectAll("*").remove();

  let legendAnchorX = centerX;
  if (legendPosition === "top-left") legendAnchorX = margin.left + 32;
  if (legendPosition === "top-right") legendAnchorX = svgWidth - margin.right - 32;

  const legendRoot = svg.append("g").attr("transform", "translate(" + legendAnchorX + "," + legendOffsetY + ")");

  const legendGroup = legendRoot
    .selectAll("g")
    .data(legendItems)
    .join("g")
    .attr("transform", function(d, i) {
      const offsetX = legendDirection === "horizontal" ? (i * 148 - (legendDirection === "horizontal" ? ((legendItems.length - 1) * 148) / 2 : 0)) : 0;
      const offsetY = legendDirection === "horizontal" ? 0 : i * (legendFontSize + 12);
      return "translate(" + offsetX + "," + offsetY + ")";
    });

  legendGroup
    .append("rect")
    .attr("x", 0)
    .attr("y", -7)
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", function(d) {
      return d.color || textMidColor;
    });

  legendGroup
    .append("text")
    .attr("x", 14)
    .attr("y", 1)
    .attr("font-size", legendFontSize)
    .attr("dominant-baseline", "middle")
    .attr("fill", textMidColor)
    .text(function(d) {
      return d.label || d.id || "Legend";
    });

  const rows = svg
    .append("g")
    .selectAll("g.row")
    .data(data)
    .join("g")
    .attr("class", "row")
    .attr("transform", function(_, i) {
      return "translate(0," + (chartTop + i * rowStep + (rowStep - barHeight) / 2) + ")";
    });

  rows
    .append("rect")
    .attr("x", function(d) {
      return leftBaseX - x(clampNumber(d.waitingArea, 0, 0, undefined));
    })
    .attr("y", 0)
    .attr("width", function(d) {
      return x(clampNumber(d.waitingArea, 0, 0, undefined));
    })
    .attr("height", barHeight)
    .attr("rx", 2)
    .attr("fill", waitingAreaColor);

  rows
    .append("rect")
    .attr("x", rightBaseX)
    .attr("y", 0)
    .attr("width", function(d) {
      return x(clampNumber(d.corridor, 0, 0, undefined));
    })
    .attr("height", barHeight)
    .attr("rx", 2)
    .attr("fill", corridorColor);

  rows
    .append("text")
    .attr("x", function(d) {
      return leftBaseX - x(clampNumber(d.waitingArea, 0, 0, undefined)) - 6;
    })
    .attr("y", barHeight / 2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 12)
    .attr("fill", textLightColor)
    .text(function(d) {
      return formatScore(d.waitingArea);
    });

  rows
    .append("text")
    .attr("x", function(d) {
      return rightBaseX + x(clampNumber(d.corridor, 0, 0, undefined)) + 6;
    })
    .attr("y", barHeight / 2)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 12)
    .attr("fill", textLightColor)
    .text(function(d) {
      return formatScore(d.corridor);
    });

  rows
    .append("text")
    .attr("x", centerX)
    .attr("y", barHeight / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 11)
    .attr("font-weight", 500)
    .attr("fill", textMidColor)
    .text(function(d) {
      return d.month || "";
    });

  const titleText = svg
    .append("text")
    .attr("x", centerX)
    .attr("y", titleY)
    .attr("text-anchor", "middle")
    .attr("font-size", titleFontSize)
    .attr("font-weight", 700)
    .attr("fill", titleColor);

  titleLines.forEach(function(line, index) {
    titleText
      .append("tspan")
      .attr("x", centerX)
      .attr("dy", index === 0 ? 0 : Math.max(14, titleFontSize + 8))
      .text(line || "");
  });

  const subtitleText = svg
    .append("text")
    .attr("x", centerX)
    .attr("y", subtitleY)
    .attr("text-anchor", "middle")
    .attr("font-size", subtitleFontSize)
    .attr("fill", subtitleColor);

  subtitleLines.forEach(function(line, index) {
    subtitleText
      .append("tspan")
      .attr("x", centerX)
      .attr("dy", index === 0 ? 0 : Math.max(12, subtitleFontSize + 4))
      .text(line || "");
  });
}

renderChart(source_data);
  `.trim(),
};

export function createSampleChartPartsMirroredMood() {
  return structuredClone(sampleChartPartsMirroredMoodTemplate);
}
