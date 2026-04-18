export const sampleIntentCases = [
  {
    prompt: "把比例改成 1:1.2",
    expectedTask: "aspect_ratio",
  },
  {
    prompt: "给我几个更柔和的颜色风格",
    expectedTask: "color_theme",
  },
  {
    prompt: "加一个 2024-01 的数据点",
    expectedTask: "element_edit",
  },
  {
    prompt: "删掉 2023-02",
    expectedTask: "element_edit",
  },
  {
    prompt: "图例横着排",
    expectedTask: "legend_edit",
  },
];
