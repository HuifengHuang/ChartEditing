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
    "",
    "Editor context:",
    safeJson(context || {}),
    "",
    "User prompt:",
    String(prompt || ""),
  ].join("\n");
}
