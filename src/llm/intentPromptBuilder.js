function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return "{}";
  }
}

export function buildIntentPrompt({ prompt, context }) {
  const singleIntentSchema = `{
  "intentId": "string",
  "intentType": "style | data",
  "task": "aspect_ratio | color_theme | element_edit | legend_edit",
  "target": ["layout | style | data | legend"],
  "action": "update | add | remove | show_panel",
  "parameters": {},
  "needPanel": true,
  "panelStrategy": "create | extend | reuse",
  "detailRequested": false
}`;
  const schemaText = `{
  "intents": [${singleIntentSchema}]
}`;

  return [
    "You are an intent parser for a mirrored mood chart editor.",
    "Return JSON ONLY. No markdown, no explanation.",
    "Output must strictly follow this schema:",
    schemaText,
    "",
    "Constraints:",
    "- task must be one of: aspect_ratio, color_theme, element_edit, legend_edit",
    "- action must be one of: update, add, remove, show_panel",
    "- intentType must be style or data",
    "- If month/value cannot be extracted, keep parameters minimal but still valid.",
    "- intents must be an array with at least 1 intent object.",
    "- If the user asks for multiple independent edits, output multiple intents in intents[] in user-mentioned order.",
    "- Do not duplicate equivalent intents for the same task unless the prompt clearly asks separate operations.",
    "- Panel-first policy: prefer exposing/reusing high-level controls first. Detail controls are only requested when needed.",
    "- detailRequested=true means the user asks to show finer-grained controls. It is NOT an independent task.",
    "- Do NOT output task=expand_controls / add_element / remove_element.",
    "- For element add/remove/edit-table requests, use task=element_edit and choose action add/remove/show_panel.",
    "- For color_theme, only set parameters.themeHint and parameters.applyPreset=true when the hint is explicit (warm/cool/soft).",
    "- Use visual and context clues for relative descriptions (e.g. taller/wider, legend closer, yellow series). Map back to one of the 4 tasks.",
    "",
    "Editor context:",
    safeJson(context || {}),
    "",
    "User prompt:",
    String(prompt || ""),
  ].join("\n");
}
