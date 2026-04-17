/**
 * @typedef {Object} IntentSpec
 * @property {string} intentId
 * @property {"style" | "data"} intentType
 * @property {"aspect_ratio" | "color_theme" | "add_element" | "remove_element" | "legend_edit" | "expand_controls"} task
 * @property {string[]} target
 * @property {"update" | "add" | "remove" | "expand_panel" | "show_panel"} action
 * @property {Record<string, any>} parameters
 * @property {boolean} needPanel
 * @property {"create" | "extend" | "reuse"} panelStrategy
 */

/**
 * @typedef {Object} UpdatePlan
 * @property {Array<{
 *   type: "set" | "add" | "remove" | "patch",
 *   path?: string,
 *   value?: any,
 *   targetCollection?: string,
 *   matcher?: any,
 *   patch?: Record<string, any>
 * }>} sourceDataUpdates
 * @property {Array<{
 *   type:
 *     | "create-section"
 *     | "create-section-with-controls"
 *     | "ensure-task-controls"
 *     | "insert-control"
 *     | "expand-section"
 *     | "highlight-section"
 *     | "reuse-panel",
 *   panelId?: string,
 *   sectionId?: string,
 *   task?: string,
 *   payload?: any
 * }>} panelUpdates
 */

export const SUPPORTED_INTENT_TASKS = [
  "aspect_ratio",
  "color_theme",
  "add_element",
  "remove_element",
  "legend_edit",
  "expand_controls",
];

export function createDefaultIntentSpec() {
  return {
    intentId: `intent_${Date.now()}`,
    intentType: "style",
    task: "color_theme",
    target: ["style"],
    action: "show_panel",
    parameters: {},
    needPanel: true,
    panelStrategy: "reuse",
  };
}
