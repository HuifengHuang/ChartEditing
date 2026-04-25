// 统一构造校验问题对象，便于日志和 UI 展示。
function createIssue(level, message, sectionId, controlId) {
  return { level, message, sectionId, controlId };
}

// 判空工具：用于校验必填字段。
function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

// 校验单个控件配置是否合法。
function validateControl(control, sectionId, issues) {
  // 先做通用必填项校验，再进入分类型校验。
  const requiredFields = ["id", "label", "controlType", "operationType", "bindingMode"];
  requiredFields.forEach((field) => {
    if (!hasValue(control?.[field])) {
      issues.push(createIssue("error", `Missing required control field: ${field}`, sectionId, control?.id));
    }
  });

  if (!control || !hasValue(control.operationType)) {
    return;
  }

  if (control.operationType === "update") {
    if (control.bindingMode === "single" && !hasValue(control.bind)) {
      issues.push(createIssue("error", "Update + single requires bind", sectionId, control.id));
    }
    if (control.bindingMode === "multi" && (!Array.isArray(control.binds) || !control.binds.length)) {
      issues.push(createIssue("error", "Update + multi requires binds", sectionId, control.id));
    }
    if (control.bindingMode === "preset" && (!Array.isArray(control.presetOptions) || !control.presetOptions.length)) {
      issues.push(createIssue("error", "Update + preset requires presetOptions", sectionId, control.id));
    }
    if (control.controlType === "select" && (!Array.isArray(control.options) || !control.options.length)) {
      issues.push(createIssue("error", "Select control requires options", sectionId, control.id));
    }
  }

  if ((control.operationType === "add" || control.operationType === "remove") && !hasValue(control.targetCollection)) {
    issues.push(createIssue("error", "Add/Remove control requires targetCollection", sectionId, control.id));
  }

  if (control.controlType === "table") {
    if (!hasValue(control.targetCollection)) {
      issues.push(createIssue("error", "Table control requires targetCollection", sectionId, control.id));
    }
    if (!hasValue(control.rowKey)) {
      issues.push(createIssue("error", "Table control requires rowKey", sectionId, control.id));
    }
    if (!hasValue(control.schemaSource)) {
      issues.push(createIssue("warning", "Table control should define schemaSource", sectionId, control.id));
    }
    if (!hasValue(control.tableOrientation)) {
      issues.push(createIssue("warning", "Table control tableOrientation defaults to auto", sectionId, control.id));
    }
  }
}

// 校验整份 panelSpec，返回 { isValid, issues }。
export function validatePanelSpec(panelSpec) {
  const issues = [];
  const requiredFields = ["panelId", "title", "panelKind", "intentType", "sections"];

  requiredFields.forEach((field) => {
    if (!hasValue(panelSpec?.[field])) {
      issues.push(createIssue("error", `Missing required panel field: ${field}`));
    }
  });

  if (!Array.isArray(panelSpec?.sections)) {
    issues.push(createIssue("error", "sections must be an array"));
    return { isValid: false, issues };
  }

  panelSpec.sections.forEach((section) => {
    if (!hasValue(section?.sectionId)) {
      issues.push(createIssue("error", "Missing required section field: sectionId"));
    }
    if (!hasValue(section?.title)) {
      issues.push(createIssue("error", "Missing required section field: title", section?.sectionId));
    }
    if (!Array.isArray(section?.controls)) {
      issues.push(createIssue("error", "Missing required section field: controls", section?.sectionId));
      return;
    }

    section.controls.forEach((control) => validateControl(control, section.sectionId, issues));
  });

  return {
    isValid: !issues.some((issue) => issue.level === "error"),
    issues,
  };
}

// 提取不支持控件的 key 集合，用于前端按控件维度降级显示。
export function getUnsupportedControlKeySet(issues) {
  const set = new Set();
  issues
    .filter((issue) => issue.level === "error" && issue.sectionId && issue.controlId)
    .forEach((issue) => set.add(`${issue.sectionId}::${issue.controlId}`));
  return set;
}
