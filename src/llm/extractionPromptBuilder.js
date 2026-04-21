function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return "{}";
  }
}

export function buildExtractionPrompt({ intent, sourceData, renderCode }) {
  const outputSchema = `{
  "updatedSourceData": {"...": "..."},
  "updatedRenderCode": "string",
  "extractionMap": {
    "parameterName": {
      "recommendation": [{"id":"string","label":"string","values":{}}],
      "primaryBindings": [{"name":"string","type":"text|number|color|bool","value":"any"}],
      "expand": [{"name":"string","type":"text|number|color|bool","value":"any"}],
      "affected": [{"name":"string","type":"text|number|color|bool","value":"any"}],
      "data": [{"...":"..."}],
      "input": [{"name":"image-x","type":"number","value":0}]
    }
  },
  "bindingMap": {"parameterName": ["field.path"]},
  "codePatches": []
}`;

  return [
    "You are the Extraction stage in a controlled chart-editing pipeline.",
    "Task type: Extraction only. Do NOT generate full UI and do NOT explain.",
    "Return STRICT JSON only. No markdown, no code fence, no extra text.",
    "",
    "Output schema:",
    outputSchema,
    "",
    "Hard rules:",
    "1) Ensure all names in extractionMap.primaryBindings/expand/affected exist in updatedSourceData.",
    "2) If a value is hardcoded in render code, rewrite updatedRenderCode to read from updatedSourceData.",
    "3) If parameter value is Recommendation, return recommendation with at least 3 presets.",
    "4) If parameter is data editing, return ONLY data + affected (no primaryBindings/expand).",
    "5) For data editing, affected must include width/height, spacing, and text content fields.",
    "6) If Input special case appears, return ONLY fixed input fields: image-x,image-y,image-width,image-height.",
    "7) Keep unchanged code/fields as-is when not related.",
    "",
    "Input Intent:",
    safeJson(intent || {}),
    "",
    "Current source_data:",
    safeJson(sourceData || {}),
    "",
    "Current render_code:",
    String(renderCode || ""),
  ].join("\n");
}
