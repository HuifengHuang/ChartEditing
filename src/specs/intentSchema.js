/**
 * @typedef {Object} IntentSpec
 * @property {string} User_prompt
 * @property {"data" | "style" | "other"} target
 * @property {"add" | "remove" | "update"} action
 * @property {boolean} expand
 * @property {Record<string, "Recommendation" | "Preset" | "None">} parameters
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

export const INTENT_TARGETS = ["data", "style", "other"];
export const INTENT_ACTIONS = ["add", "remove", "update"];
export const INTENT_PARAMETER_VALUES = ["Recommendation", "Preset", "None"];

export function createDefaultIntentSpec() {
  return {
    User_prompt: "",
    target: "style",
    action: "update",
    expand: false,
    parameters: {},
  };
}

