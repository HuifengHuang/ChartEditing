function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return "{}";
  }
}

export function buildIntentPrompt({ prompt, context }) {
  const schemaText = `{
  "intentId": "string",
  "intentType": "style | data",
  "task": "aspect_ratio | color_theme | add_element | remove_element | legend_edit | expand_controls",
  "target": ["layout | style | data | legend | controls"],
  "action": "update | add | remove | expand_panel | show_panel",
  "parameters": {},
  "needPanel": true,
  "panelStrategy": "create | extend | reuse"
}`;

  return [
    "You are an intent parser for a mirrored mood chart editor.",
    "Return JSON ONLY. No markdown, no explanation.",
    "Output must strictly follow this schema:",
    schemaText,
    "",
    "Constraints:",
    "- task must be one of: aspect_ratio, color_theme, add_element, remove_element, legend_edit, expand_controls",
    "- action must be one of: update, add, remove, expand_panel, show_panel",
    "- intentType must be style or data",
    "- If month/value cannot be extracted, keep parameters minimal but still valid.",
    "- Panel-first policy: prefer exposing/reusing high-level controls, then expand detail sections only when user asks for details.",
    "- For color_theme: DO NOT set themeHint by default. Only set parameters.themeHint + parameters.applyPreset=true when user explicitly asks warm/cool/soft theme.",
    "- For color detail requests (e.g. show all color items), prefer task=color_theme with parameters.detail=true, or task=expand_controls with target=['style'].",
    "- For expand/detail requests, set task=expand_controls and include specific targets among: layout/style/data/legend when possible.",
    "- For legend item editing requests, prefer task=legend_edit and set parameters.editItems=true.",
    "",
    "Editor context:",
    safeJson(context || {}),
    "",
    "User prompt:",
    String(prompt || ""),
  ].join("\n");
}
