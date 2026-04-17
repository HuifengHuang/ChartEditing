import { getAffectedControlConfig, getTaskSections } from "../specs/taskControlRegistry.js";

function ensureUiState(panelSpec) {
  if (!panelSpec.uiState || typeof panelSpec.uiState !== "object") {
    panelSpec.uiState = {
      expandedSections: [],
      highlightedSectionId: null,
    };
  }
  if (!Array.isArray(panelSpec.uiState.expandedSections)) {
    panelSpec.uiState.expandedSections = [];
  }
}

function ensureSections(panelSpec) {
  if (!Array.isArray(panelSpec.sections)) {
    panelSpec.sections = [];
  }
}

function findSection(panelSpec, sectionId) {
  return (panelSpec.sections || []).find((section) => section.sectionId === sectionId);
}

function ensureSection(panelSpec, sectionTemplate) {
  let section = findSection(panelSpec, sectionTemplate.sectionId);
  if (!section) {
    section = {
      sectionId: sectionTemplate.sectionId,
      title: sectionTemplate.title || sectionTemplate.sectionId,
      priority: sectionTemplate.priority || "secondary",
      controls: [],
    };
    panelSpec.sections.push(section);
  }
  if (!Array.isArray(section.controls)) {
    section.controls = [];
  }
  return section;
}

function hasControl(section, controlId) {
  return (section.controls || []).some((control) => control.id === controlId);
}

function appendControl(section, control) {
  if (!control?.id) {
    return false;
  }
  if (hasControl(section, control.id)) {
    return false;
  }
  section.controls.push(control);
  return true;
}

function maybeApplyImpactControls(panelSpec, control) {
  if (!control || !Array.isArray(control.affectedBindings)) {
    return;
  }

  if (control.impactPolicy === "auto-adjust") {
    return;
  }

  if (control.impactPolicy !== "show-affected-controls" && control.impactPolicy !== "mixed") {
    return;
  }

  control.affectedBindings.forEach((bindingKey) => {
    const affectedConfig = getAffectedControlConfig(bindingKey);
    if (!affectedConfig?.control || !affectedConfig.sectionId) {
      return;
    }
    const section = ensureSection(panelSpec, {
      sectionId: affectedConfig.sectionId,
      title: affectedConfig.sectionTitle,
      priority: affectedConfig.priority,
    });
    appendControl(section, affectedConfig.control);
  });
}

function mergeTaskSections(panelSpec, task) {
  const taskSections = getTaskSections(task);

  taskSections.forEach((sectionTemplate) => {
    const section = ensureSection(panelSpec, sectionTemplate);
    (sectionTemplate.controls || []).forEach((control) => {
      const inserted = appendControl(section, control);
      if (inserted) {
        maybeApplyImpactControls(panelSpec, control);
      }
    });
  });
}

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
}

export function updatePanelSpec(currentPanelSpec, panelUpdates) {
  const nextPanelSpec = safeClone(currentPanelSpec);
  ensureSections(nextPanelSpec);
  ensureUiState(nextPanelSpec);

  (panelUpdates || []).forEach((update) => {
    if (update.type === "reuse-panel") {
      return;
    }

    if (update.type === "highlight-section") {
      nextPanelSpec.uiState.highlightedSectionId = update.sectionId || null;
      return;
    }

    if (update.type === "expand-section") {
      if (!update.sectionId) {
        return;
      }
      const set = new Set(nextPanelSpec.uiState.expandedSections);
      set.add(update.sectionId);
      nextPanelSpec.uiState.expandedSections = Array.from(set);
      return;
    }

    if (update.type === "create-section-with-controls") {
      mergeTaskSections(nextPanelSpec, update.task);
      return;
    }

    if (update.type === "ensure-task-controls") {
      mergeTaskSections(nextPanelSpec, update.task);
      return;
    }

    if (update.type === "create-section") {
      if (!update.payload || !update.payload.sectionId) {
        return;
      }
      ensureSection(nextPanelSpec, update.payload);
      return;
    }

    if (update.type === "insert-control") {
      const section = findSection(nextPanelSpec, update.sectionId);
      if (!section || !update.payload) {
        return;
      }
      const inserted = appendControl(section, update.payload);
      if (inserted) {
        maybeApplyImpactControls(nextPanelSpec, update.payload);
      }
    }
  });

  return nextPanelSpec;
}
