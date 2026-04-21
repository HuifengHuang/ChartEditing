export const sampleIntentCases = [
  {
    prompt: "给我几个更柔和的颜色风格",
    expectedIntent: {
      target: "style",
      action: "update",
      expand: true,
      parameters: {
        color_theme: "Recommendation",
      },
    },
  },
  {
    prompt: "我想调整一下数据图的宽度和高度",
    expectedIntent: {
      target: "style",
      action: "update",
      expand: false,
      parameters: {
        chart_width: "Preset",
        chart_height: "Preset",
      },
    },
  },
  {
    prompt: "我想上传一张图片放到图表中",
    expectedIntent: {
      target: "other",
      action: "add",
      expand: false,
      parameters: {
        Input: "None",
      },
    },
  },
  {
    prompt: "新增一行数据",
    expectedIntent: {
      target: "data",
      action: "add",
      expand: false,
      parameters: {
        data_table: "Preset",
      },
    },
  },
  {
    prompt: "删除一行数据",
    expectedIntent: {
      target: "data",
      action: "remove",
      expand: false,
      parameters: {
        data_table: "Preset",
      },
    },
  },
  {
    prompt: "修改图例颜色",
    expectedIntent: {
      target: "style",
      action: "update",
      expand: false,
      parameters: {
        legend_color: "Preset",
      },
    },
  },
  {
    prompt: "修改图表比例",
    expectedIntent: {
      target: "style",
      action: "update",
      expand: false,
      parameters: {
        aspect_ratio: "Preset",
      },
    },
  },
];

