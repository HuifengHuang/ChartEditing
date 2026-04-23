/**
 * @typedef {Object} PanelSpec
 * @property {string} panelId
 * @property {string} title
 * @property {string=} description
 * @property {"property"|"collection"|"mixed"} panelKind
 * @property {"style"|"data"} intentType
 * @property {string[]=} scope
 * @property {"static"|"generated"=} origin
 * @property {"temporary"|"persistent"=} persistence
 * @property {{promptTrace?: string, relatedObjects?: string[]}=} generationContext
 * @property {PanelSection[]} sections
 */

/**
 * @typedef {Object} PanelSection
 * @property {string} sectionId
 * @property {string} title
 * @property {string=} description
 * @property {"primary"|"secondary"|"detail"=} priority
 * @property {PanelControl[]} controls
 */

/**
 * @typedef {Object} PanelControl
 * @property {string} id
 * @property {string} label
 * @property {string=} description
 * @property {string=} warningMessage
 * @property {"number"|"slider"|"text"|"color"|"select"|"toggle"|"action"|"select-action"|"preset-select"|"table"} controlType
 * @property {"update"|"add"|"remove"} operationType
 * @property {"single"|"multi"|"preset"|"collection"} bindingMode
 * @property {string=} bind
 * @property {string[]=} binds
 * @property {string=} targetCollection
 * @property {"number"|"string"|"color"|"boolean"|"object"=} valueType
 * @property {any=} defaultValue
 * @property {boolean=} editable
 * @property {{min?: number, max?: number, step?: number}=} range
 * @property {any[]=} options
 * @property {Array<{id: string, label: string, description?: string, patch: Record<string, any>}>=} presetOptions
 * @property {Record<string, string>=} itemSchema
 * @property {Record<string, any>=} initialValue
 * @property {string[]=} effects
 * @property {string[]=} affectedBindings
 * @property {"auto-adjust"|"show-affected-controls"|"mixed"=} impactPolicy
 * @property {string=} impactDescription
 * @property {boolean=} expandable
 * @property {boolean=} expandedByDefault
 * @property {string=} detailSectionRef
 * @property {"realtime"|"apply"=} previewMode
 * @property {{path: string, equals: any}|null=} visibilityCondition
 * @property {Array<{key: string, label?: string, valueType?: "number"|"string"|"color"|"boolean", editable?: boolean, hidden?: boolean}>=} tableSchema
 * @property {"auto"|"manual"|"mixed"=} schemaSource
 * @property {"auto"|"row-major"|"column-major"=} tableOrientation
 * @property {string=} orientationKey
 * @property {string[]=} columnOrder
 * @property {string=} rowKey
 * @property {Array<"add"|"remove">=} rowActions
 * @property {{targetCollection: string, rowKey: string, fields: Array<{key: string, label?: string, valueType?: "number"|"string"|"color"|"boolean", editable?: boolean}>}=} itemEditor
 */

/** @type {PanelSpec} */
export const samplePanelSpec = {
  panelId: "chart_editing_panel_v2",
  title: "PanelSpec Driven Controls",
  description: "PanelSpec -> ControlPanelRenderer -> source_data -> preview",
  panelKind: "mixed",
  intentType: "data",
  scope: ["chart", "data", "legend", "style"],
  origin: "static",
  persistence: "temporary",
  generationContext: {
    promptTrace: "sample-static-panel-spec",
    relatedObjects: ["source_data", "render_code"],
  },
  sections: [
    {
      sectionId: "layout_primary",
      title: "Layout",
      priority: "primary",
      controls: [
        {
          id: "aspect_ratio",
          label: "Aspect Ratio",
          description: "Macro control that updates chartWidth + chartHeight together",
          controlType: "select",
          operationType: "update",
          bindingMode: "multi",
          bind: "source_data.meta.aspectRatioPreset",
          binds: ["source_data.chartWidth", "source_data.chartHeight"],
          options: [
            {
              label: "16:9",
              value: "16:9",
              patch: {
                "source_data.chartWidth": 640,
                "source_data.chartHeight": 360,
              },
            },
            {
              label: "4:3",
              value: "4:3",
              patch: {
                "source_data.chartWidth": 640,
                "source_data.chartHeight": 480,
              },
            },
            {
              label: "1:1",
              value: "1:1",
              patch: {
                "source_data.chartWidth": 520,
                "source_data.chartHeight": 520,
              },
            },
          ],
          defaultValue: "16:9",
          effects: ["chartWidth", "chartHeight"],
          affectedBindings: ["source_data.chartWidth", "source_data.chartHeight"],
          impactPolicy: "show-affected-controls",
          impactDescription: "Adjusting aspect ratio updates width and height together.",
          expandable: true,
          detailSectionRef: "layout_detail",
        },
        {
          id: "fixed_chart_size",
          label: "Fixed Chart Size",
          controlType: "toggle",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.fixedChartSize",
          valueType: "boolean",
          defaultValue: false,
        },
        {
          id: "bar_gap",
          label: "Bar Gap",
          controlType: "slider",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.barGap",
          valueType: "number",
          range: {
            min: 0,
            max: 0.9,
            step: 0.05,
          },
          visibilityCondition: {
            path: "source_data.fixedChartSize",
            equals: false,
          },
        },
      ],
    },
    {
      sectionId: "layout_detail",
      title: "Layout Detail",
      priority: "detail",
      controls: [
        {
          id: "chart_width",
          label: "Chart Width",
          controlType: "number",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.chartWidth",
          valueType: "number",
          range: { min: 320, max: 1200, step: 10 },
        },
        {
          id: "chart_height",
          label: "Chart Height",
          controlType: "number",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.chartHeight",
          valueType: "number",
          range: { min: 240, max: 900, step: 10 },
        },
        {
          id: "title_font_size",
          label: "Title Font Size",
          controlType: "slider",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.titleFontSize",
          valueType: "number",
          range: { min: 12, max: 48, step: 1 },
        },
        {
          id: "title_text",
          label: "Title Text",
          controlType: "text",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.titleText",
          valueType: "string",
        },
      ],
    },
    {
      sectionId: "theme_primary",
      title: "Theme",
      priority: "primary",
      controls: [
        {
          id: "color_theme",
          label: "Color Theme",
          description: "Preset style patches",
          controlType: "preset-select",
          operationType: "update",
          bindingMode: "preset",
          presetOptions: [
            {
              id: "theme_blue",
              label: "Blue Modern",
              patch: {
                "source_data.barColor": "#2563eb",
                "source_data.titleColor": "#0f172a",
                "source_data.backgroundColor": "#ffffff",
              },
            },
            {
              id: "theme_emerald",
              label: "Emerald",
              patch: {
                "source_data.barColor": "#059669",
                "source_data.titleColor": "#064e3b",
                "source_data.backgroundColor": "#ecfdf5",
              },
            },
            {
              id: "theme_sunset",
              label: "Sunset",
              patch: {
                "source_data.barColor": "#f97316",
                "source_data.titleColor": "#7c2d12",
                "source_data.backgroundColor": "#fff7ed",
              },
            },
          ],
          expandable: true,
          detailSectionRef: "theme_detail",
          impactPolicy: "mixed",
          impactDescription: "Applying a preset updates multiple style bindings together.",
        },
      ],
    },
    {
      sectionId: "theme_detail",
      title: "Theme Detail",
      priority: "detail",
      controls: [
        {
          id: "bar_color",
          label: "Bar Color",
          controlType: "color",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.barColor",
          valueType: "color",
        },
        {
          id: "title_color",
          label: "Title Color",
          controlType: "color",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.titleColor",
          valueType: "color",
        },
        {
          id: "background_color",
          label: "Background Color",
          controlType: "color",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.backgroundColor",
          valueType: "color",
        },
      ],
    },
    {
      sectionId: "data_primary",
      title: "Data",
      priority: "primary",
      controls: [
        {
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
          defaultValue: "row-major",
        },
        {
          id: "dataset_table",
          label: "Dataset Editor",
          controlType: "table",
          operationType: "update",
          bindingMode: "collection",
          targetCollection: "source_data.data",
          rowKey: "category",
          rowActions: ["add", "remove"],
          schemaSource: "mixed",
          tableOrientation: "auto",
          orientationKey: "source_data.meta.tableOrientation",
          tableSchema: [
            { key: "category", label: "Category", valueType: "string", editable: true },
            { key: "value", label: "Value", valueType: "number", editable: true },
          ],
          initialValue: {
            category: "New",
            value: 50,
          },
        },
        {
          id: "add_data_row",
          label: "Add Row",
          controlType: "action",
          operationType: "add",
          bindingMode: "collection",
          targetCollection: "source_data.data",
          itemSchema: {
            category: "string",
            value: "number",
          },
          initialValue: {
            category: "New",
            value: 50,
          },
        },
        {
          id: "remove_data_row",
          label: "Remove Row",
          controlType: "select-action",
          operationType: "remove",
          bindingMode: "collection",
          targetCollection: "source_data.data",
          rowKey: "category",
        },
      ],
    },
    {
      sectionId: "legend_primary",
      title: "Legend",
      priority: "primary",
      controls: [
        {
          id: "legend_text_size",
          label: "Legend Text Size",
          controlType: "number",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.legend.textSize",
          valueType: "number",
          range: { min: 10, max: 24, step: 1 },
        },
        {
          id: "legend_direction",
          label: "Legend Direction",
          controlType: "select",
          operationType: "update",
          bindingMode: "single",
          bind: "source_data.legend.direction",
          options: [
            { label: "Horizontal", value: "horizontal" },
            { label: "Vertical", value: "vertical" },
          ],
          expandable: true,
          detailSectionRef: "legend_detail",
        },
      ],
    },
    {
      sectionId: "legend_detail",
      title: "Legend Items",
      priority: "detail",
      controls: [
        {
          id: "legend_items_table",
          label: "Legend Item Editor",
          controlType: "table",
          operationType: "update",
          bindingMode: "collection",
          targetCollection: "source_data.legend.items",
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
            color: "#6b7280",
          },
          itemEditor: {
            targetCollection: "source_data.legend.items",
            rowKey: "id",
            fields: [
              { key: "id", label: "ID", valueType: "string", editable: true },
              { key: "label", label: "Label", valueType: "string", editable: true },
              { key: "color", label: "Color", valueType: "color", editable: true },
            ],
          },
        },
      ],
    },
  ],
};
