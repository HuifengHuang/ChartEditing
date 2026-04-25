import { getAffectedControlConfig, getSectionTemplateById, getTaskSections } from "../specs/taskControlRegistry.js";

// 确保 uiState 结构完整，避免运行时访问空对象。
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

// 确保 sections 是可迭代数组。
function ensureSections(panelSpec) {
  if (!Array.isArray(panelSpec.sections)) {
    panelSpec.sections = [];
  }
}

// 查找指定 section。
function findSection(panelSpec, sectionId) {
  return (panelSpec.sections || []).find((section) => section.sectionId === sectionId);
}

// 按模板确保 section 存在；不存在则创建。
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

// 判断 section 中是否已有指定控件。
function hasControl(section, controlId) {
  return (section.controls || []).some((control) => control.id === controlId);
}

// 追加控件并去重，返回是否插入成功。
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

// 根据控件影响策略，补充“受影响控件”到对应分区。
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

// 合并某任务对应的所有分区与控件。
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

// 深拷贝兜底：优先 structuredClone，失败时回退 JSON。
function safeClone(value) {
  try {
    return structuredClone(value);
  } catch (error) {
    return JSON.parse(JSON.stringify(value));
  }
}

// 根据 panelUpdates 指令更新 panelSpec，输出新对象。
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

    // 扩展分区时：若分区不存在，尝试从注册表补模板。
    if (update.type === "expand-section") {
      if (!update.sectionId) {
        return;
      }
      if (!findSection(nextPanelSpec, update.sectionId)) {
        const template = getSectionTemplateById(update.sectionId);
        if (template) {
          ensureSection(nextPanelSpec, template);
        }
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
