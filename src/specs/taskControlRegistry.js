function createControlTemplates() {
  const controls = {
    aspect_ratio: {
      id: "aspect_ratio",
      label: "Aspect Ratio",
      description: "Macro layout control for width/height related values",
      controlType: "select",
      operationType: "update",
      bindingMode: "multi",
      bind: "source_data.meta.aspectRatioPreset",
      binds: [
        "source_data.layout.svgWidth",
        "source_data.layout.svgHeight",
        "source_data.layout.chartTop",
        "source_data.layout.chartBottom",
      ],
      options: [
        {
          label: "420 x 520 (Original)",
          value: "420x520",
          patch: {
            "source_data.layout.svgWidth": 420,
            "source_data.layout.svgHeight": 520,
            "source_data.layout.chartTop": 54,
            "source_data.layout.chartBottom": 382,
          },
        },
        {
          label: "480 x 560 (Balanced)",
          value: "480x560",
          patch: {
            "source_data.layout.svgWidth": 480,
            "source_data.layout.svgHeight": 560,
            "source_data.layout.chartTop": 58,
            "source_data.layout.chartBottom": 410,
          },
        },
        {
          label: "540 x 600 (Wide)",
          value: "540x600",
          patch: {
            "source_data.layout.svgWidth": 540,
            "source_data.layout.svgHeight": 600,
            "source_data.layout.chartTop": 62,
            "source_data.layout.chartBottom": 438,
          },
        },
      ],
      expandable: true,
      detailSectionRef: "layout_detail",
      impactPolicy: "show-affected-controls",
      affectedBindings: [
        "source_data.layout.svgWidth",
        "source_data.layout.svgHeight",
        "source_data.layout.chartTop",
        "source_data.layout.chartBottom",
        "source_data.layout.barHeight",
        "source_data.layout.labelGap",
      ],
      impactDescription: "Shows width/height/top/bottom controls for fine tuning.",
    },
    svg_width: {
      id: "svg_width",
      label: "SVG Width",
      controlType: "number",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.svgWidth",
      valueType: "number",
      range: { min: 280, max: 1200, step: 10 },
    },
    svg_height: {
      id: "svg_height",
      label: "SVG Height",
      controlType: "number",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.svgHeight",
      valueType: "number",
      range: { min: 320, max: 1200, step: 10 },
    },
    chart_top: {
      id: "chart_top",
      label: "Chart Top",
      controlType: "number",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.chartTop",
      valueType: "number",
      range: { min: 0, max: 480, step: 1 },
    },
    chart_bottom: {
      id: "chart_bottom",
      label: "Chart Bottom",
      controlType: "number",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.chartBottom",
      valueType: "number",
      range: { min: 100, max: 900, step: 1 },
    },
    bar_height: {
      id: "bar_height",
      label: "Bar Height",
      controlType: "slider",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.barHeight",
      valueType: "number",
      range: { min: 6, max: 40, step: 1 },
    },
    label_gap: {
      id: "label_gap",
      label: "Center Label Gap",
      controlType: "slider",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.labelGap",
      valueType: "number",
      range: { min: 18, max: 180, step: 1 },
    },
    color_theme: {
      id: "color_theme",
      label: "Color Theme",
      controlType: "preset-select",
      operationType: "update",
      bindingMode: "preset",
      presetOptions: [
        {
          id: "original",
          label: "Original Warm",
          patch: {
            "source_data.style.waitingAreaColor": "#c75b4e",
            "source_data.style.corridorColor": "#efc45a",
            "source_data.style.titleColor": "#3f3f3f",
            "source_data.style.subtitleColor": "#808080",
          },
        },
        {
          id: "soft",
          label: "Soft",
          patch: {
            "source_data.style.waitingAreaColor": "#d97795",
            "source_data.style.corridorColor": "#f9c66e",
            "source_data.style.titleColor": "#4b5563",
            "source_data.style.subtitleColor": "#6b7280",
          },
        },
        {
          id: "cool",
          label: "Cool",
          patch: {
            "source_data.style.waitingAreaColor": "#2563eb",
            "source_data.style.corridorColor": "#38bdf8",
            "source_data.style.titleColor": "#0f172a",
            "source_data.style.subtitleColor": "#334155",
          },
        },
      ],
      expandable: true,
      detailSectionRef: "theme_detail",
      impactPolicy: "show-affected-controls",
      affectedBindings: [
        "source_data.style.waitingAreaColor",
        "source_data.style.corridorColor",
        "source_data.style.titleColor",
        "source_data.style.subtitleColor",
      ],
      impactDescription: "Shows key color controls after theme selection.",
    },
    waiting_color: {
      id: "waiting_color",
      label: "Waiting Area Color",
      controlType: "color",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.style.waitingAreaColor",
      valueType: "color",
    },
    corridor_color: {
      id: "corridor_color",
      label: "Corridor Color",
      controlType: "color",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.style.corridorColor",
      valueType: "color",
    },
    title_color: {
      id: "title_color",
      label: "Title Color",
      controlType: "color",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.style.titleColor",
      valueType: "color",
    },
    subtitle_color: {
      id: "subtitle_color",
      label: "Subtitle Color",
      controlType: "color",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.style.subtitleColor",
      valueType: "color",
    },
    table_orientation: {
      id: "table_orientation",
      label: "Table Orientation",
      controlType: "select",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.meta.tableOrientation",
      options: [
        { label: "Row Major", value: "row-major" },
        { label: "Column Major", value: "column-major" },
      ],
    },
    mood_data_table: {
      id: "mood_data_table",
      label: "Data Table",
      controlType: "table",
      operationType: "update",
      bindingMode: "collection",
      targetCollection: "source_data.data",
      rowKey: "month",
      rowActions: ["add", "remove"],
      schemaSource: "mixed",
      tableOrientation: "auto",
      orientationKey: "source_data.meta.tableOrientation",
      tableSchema: [
        { key: "month", label: "Month", valueType: "string", editable: true },
        { key: "waitingArea", label: "Waiting Area", valueType: "number", editable: true },
        { key: "corridor", label: "Corridor", valueType: "number", editable: true },
      ],
      initialValue: {
        month: "2024-01",
        waitingArea: 9.1,
        corridor: 8.8,
      },
    },
    fixed_chart_size: {
      id: "fixed_chart_size",
      label: "Fixed Chart Size",
      description: "When true, row spacing auto-fits data length.",
      controlType: "toggle",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.fixedChartSize",
      valueType: "boolean",
      impactPolicy: "mixed",
      affectedBindings: [
        "data_policy.barGap",
        "data_policy.barHeight",
        "data_policy.chartTop",
        "data_policy.chartBottom",
      ],
    },
    policy_bar_gap: {
      id: "policy_bar_gap",
      label: "barGap",
      controlType: "slider",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.labelGap",
      valueType: "number",
      range: { min: 18, max: 180, step: 1 },
      visibilityCondition: {
        path: "source_data.layout.fixedChartSize",
        equals: false,
      },
    },
    policy_bar_height: {
      id: "policy_bar_height",
      label: "Bar Height",
      controlType: "slider",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.barHeight",
      valueType: "number",
      range: { min: 6, max: 40, step: 1 },
      visibilityCondition: {
        path: "source_data.layout.fixedChartSize",
        equals: false,
      },
    },
    policy_chart_top: {
      id: "policy_chart_top",
      label: "Chart Top",
      controlType: "number",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.chartTop",
      valueType: "number",
      range: { min: 0, max: 480, step: 1 },
      visibilityCondition: {
        path: "source_data.layout.fixedChartSize",
        equals: false,
      },
    },
    policy_chart_bottom: {
      id: "policy_chart_bottom",
      label: "Chart Bottom",
      controlType: "number",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.layout.chartBottom",
      valueType: "number",
      range: { min: 100, max: 900, step: 1 },
      visibilityCondition: {
        path: "source_data.layout.fixedChartSize",
        equals: false,
      },
    },
    legend_font_size: {
      id: "legend_font_size",
      label: "Legend Font Size",
      controlType: "number",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.legend.legendFontSize",
      valueType: "number",
      range: { min: 9, max: 24, step: 1 },
    },
    legend_direction: {
      id: "legend_direction",
      label: "Legend Direction",
      controlType: "select",
      operationType: "update",
      bindingMode: "single",
      bind: "source_data.legend.legendDirection",
      options: [
        { label: "Horizontal", value: "horizontal" },
        { label: "Vertical", value: "vertical" },
      ],
      expandable: true,
      detailSectionRef: "legend_detail",
      impactPolicy: "show-affected-controls",
      affectedBindings: ["legend.items.editor"],
    },
    legend_items_table: {
      id: "legend_items_table",
      label: "Legend Items",
      controlType: "table",
      operationType: "update",
      bindingMode: "collection",
      targetCollection: "source_data.legend.legendItems",
      rowKey: "id",
      rowActions: ["add", "remove"],
      schemaSource: "mixed",
      tableOrientation: "row-major",
      tableSchema: [
        { key: "id", label: "ID", valueType: "string", editable: true },
        { key: "label", label: "Label", valueType: "string", editable: true },
        { key: "color", label: "Color", valueType: "color", editable: true },
      ],
      initialValue: {
        id: "item_new",
        label: "New Item",
        color: "#64748b",
      },
    },
  };

  return controls;
}

const CONTROL_TEMPLATES = createControlTemplates();

const TASK_SECTION_REGISTRY = {
  aspect_ratio: {
    primarySectionId: "layout_primary",
    sections: [
      {
        sectionId: "layout_primary",
        title: "Layout",
        priority: "primary",
        controls: [CONTROL_TEMPLATES.aspect_ratio],
      },
      {
        sectionId: "layout_detail",
        title: "Layout Detail",
        priority: "detail",
        controls: [],
      },
    ],
  },
  color_theme: {
    primarySectionId: "theme_primary",
    sections: [
      {
        sectionId: "theme_primary",
        title: "Color Theme",
        priority: "primary",
        controls: [CONTROL_TEMPLATES.color_theme],
      },
      {
        sectionId: "theme_detail",
        title: "Theme Detail",
        priority: "detail",
        controls: [],
      },
    ],
  },
  element_edit: {
    primarySectionId: "data_table",
    sections: [
      {
        sectionId: "data_table",
        title: "Data Table",
        priority: "primary",
        controls: [
          CONTROL_TEMPLATES.table_orientation,
          CONTROL_TEMPLATES.mood_data_table,
          CONTROL_TEMPLATES.fixed_chart_size,
        ],
      },
    ],
  },
  legend_edit: {
    primarySectionId: "legend_primary",
    sections: [
      {
        sectionId: "legend_primary",
        title: "Legend",
        priority: "primary",
        controls: [CONTROL_TEMPLATES.legend_font_size, CONTROL_TEMPLATES.legend_direction],
      },
      {
        sectionId: "legend_detail",
        title: "Legend Items Detail",
        priority: "detail",
        controls: [],
      },
    ],
  },
};

const AFFECTED_CONTROL_REGISTRY = {
  "source_data.layout.svgWidth": {
    sectionId: "layout_detail",
    sectionTitle: "Layout Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.svg_width,
  },
  "source_data.layout.svgHeight": {
    sectionId: "layout_detail",
    sectionTitle: "Layout Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.svg_height,
  },
  "source_data.layout.chartTop": {
    sectionId: "layout_detail",
    sectionTitle: "Layout Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.chart_top,
  },
  "source_data.layout.chartBottom": {
    sectionId: "layout_detail",
    sectionTitle: "Layout Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.chart_bottom,
  },
  "source_data.layout.barHeight": {
    sectionId: "layout_detail",
    sectionTitle: "Layout Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.bar_height,
  },
  "source_data.layout.labelGap": {
    sectionId: "layout_detail",
    sectionTitle: "Layout Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.label_gap,
  },
  "source_data.style.waitingAreaColor": {
    sectionId: "theme_detail",
    sectionTitle: "Theme Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.waiting_color,
  },
  "source_data.style.corridorColor": {
    sectionId: "theme_detail",
    sectionTitle: "Theme Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.corridor_color,
  },
  "source_data.style.titleColor": {
    sectionId: "theme_detail",
    sectionTitle: "Theme Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.title_color,
  },
  "source_data.style.subtitleColor": {
    sectionId: "theme_detail",
    sectionTitle: "Theme Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.subtitle_color,
  },
  "data_policy.barGap": {
    sectionId: "data_table",
    sectionTitle: "Data Table",
    priority: "primary",
    control: CONTROL_TEMPLATES.policy_bar_gap,
  },
  "data_policy.barHeight": {
    sectionId: "data_table",
    sectionTitle: "Data Table",
    priority: "primary",
    control: CONTROL_TEMPLATES.policy_bar_height,
  },
  "data_policy.chartTop": {
    sectionId: "data_table",
    sectionTitle: "Data Table",
    priority: "primary",
    control: CONTROL_TEMPLATES.policy_chart_top,
  },
  "data_policy.chartBottom": {
    sectionId: "data_table",
    sectionTitle: "Data Table",
    priority: "primary",
    control: CONTROL_TEMPLATES.policy_chart_bottom,
  },
  "legend.items.editor": {
    sectionId: "legend_detail",
    sectionTitle: "Legend Items Detail",
    priority: "detail",
    control: CONTROL_TEMPLATES.legend_items_table,
  },
};

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const TASK_DETAIL_REGISTRY = {
  aspect_ratio: {
    primarySectionId: "layout_primary",
    detailSectionIds: ["layout_detail"],
  },
  color_theme: {
    primarySectionId: "theme_primary",
    detailSectionIds: ["theme_detail"],
  },
  element_edit: {
    primarySectionId: "data_table",
    detailSectionIds: ["data_table"],
  },
  legend_edit: {
    primarySectionId: "legend_primary",
    detailSectionIds: ["legend_detail"],
  },
};

const TARGET_TASK_REGISTRY = {
  layout: ["aspect_ratio"],
  style: ["color_theme"],
  theme: ["color_theme"],
  color: ["color_theme"],
  data: ["element_edit"],
  legend: ["legend_edit"],
  controls: ["aspect_ratio", "color_theme", "element_edit", "legend_edit"],
};

export function getTaskPrimarySectionId(task) {
  return TASK_DETAIL_REGISTRY[task]?.primarySectionId || TASK_SECTION_REGISTRY[task]?.primarySectionId || "layout_primary";
}

export function getTaskSections(task) {
  const sections = TASK_SECTION_REGISTRY[task]?.sections || [];
  return safeClone(sections);
}

export function getAffectedControlConfig(bindingKey) {
  const config = AFFECTED_CONTROL_REGISTRY[bindingKey];
  return config ? safeClone(config) : null;
}

export function getTaskDetailSectionIds(task) {
  const sectionIds = TASK_DETAIL_REGISTRY[task]?.detailSectionIds || [];
  return safeClone(sectionIds);
}

export function getTasksByTarget(target) {
  const tasks = TARGET_TASK_REGISTRY[target] || [];
  return safeClone(tasks);
}

export function getSectionTemplateById(sectionId) {
  const tasks = Object.keys(TASK_SECTION_REGISTRY);
  for (const task of tasks) {
    const section = (TASK_SECTION_REGISTRY[task]?.sections || []).find((item) => item.sectionId === sectionId);
    if (section) {
      return safeClone(section);
    }
  }
  return null;
}
