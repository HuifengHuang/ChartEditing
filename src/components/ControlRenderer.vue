<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ensureCollectionByPath, getCollectionByPath } from "../utils/collectionUtils";
import { getValueByPath, setValueByPath } from "../utils/pathUtils";

const props = defineProps({
  control: {
    type: Object,
    required: true,
  },
  parts: {
    type: Object,
    required: true,
  },
  isUnsupported: {
    type: Boolean,
    default: false,
  },
  isDetailExpanded: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["apply-patch", "add-item", "remove-item", "toggle-detail"]);

const removeSelection = ref("");
const presetSelection = ref("");
const singleDraftValue = ref("");
const singleDraftEditing = ref(false);
const multiDraftValue = ref("");
const multiDraftEditing = ref(false);
const tableCellDraftMap = ref({});
const arrayItemDraftMap = ref({});
const activeArrayCell = ref(null);
const HOLD_START_DELAY_MS = 280;
const HOLD_REPEAT_MS = 80;
let holdStartTimer = null;
let holdRepeatTimer = null;
let holdActiveKey = "";
const colorHexPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// 根据 visibilityCondition 动态决定控件是否显示。
const isVisible = computed(() => {
  const condition = props.control.visibilityCondition;
  if (!condition) {
    return true;
  }
  const currentValue = getValueByPath(props.parts, condition.path);
  return currentValue === condition.equals;
});

// 读取控件绑定的集合数据；表格类型会自动确保集合存在。
const collection = computed(() => {
  if (!props.control.targetCollection) {
    return [];
  }
  if (props.control.controlType === "table") {
    return ensureCollectionByPath(props.parts, props.control.targetCollection);
  }
  return getCollectionByPath(props.parts, props.control.targetCollection);
});

// 生成“删除项”下拉选项：优先使用显式 options，否则按 rowKey 自动推断。
const removeOptions = computed(() => {
  if (!props.control.targetCollection) {
    return [];
  }

  if (Array.isArray(props.control.options) && props.control.options.length) {
    return props.control.options.map((option) => {
      if (option && typeof option === "object") {
        return option;
      }
      return { label: String(option), value: option };
    });
  }

  const rowKey = props.control.rowKey || "id";
  return collection.value.map((item, index) => ({
    label: String(item?.[rowKey] ?? `Row ${index + 1}`),
    value: item?.[rowKey] ?? index,
  }));
});

// 删除选项变化时，保持 removeSelection 始终指向有效项。
watch(
  removeOptions,
  (options) => {
    if (!options.length) {
      removeSelection.value = "";
      return;
    }
    if (!options.some((option) => String(option.value) === String(removeSelection.value))) {
      removeSelection.value = options[0].value;
    }
  },
  { immediate: true }
);

// 读取单绑定控件当前值，不存在时回退 defaultValue。
const currentSingleValue = computed(() => {
  const control = props.control;
  if (!control.bind) {
    return control.defaultValue;
  }
  const value = getValueByPath(props.parts, control.bind);
  if (value === undefined) {
    return control.defaultValue;
  }
  return value;
});

// 读取多绑定控件当前值：优先自定义 getter，其次 bind/binds。
const currentMultiValue = computed(() => {
  const control = props.control;
  if (typeof control.multiValueGetter === "function") {
    return control.multiValueGetter(props.parts);
  }
  if (control.bind) {
    return getValueByPath(props.parts, control.bind);
  }
  const firstBind = Array.isArray(control.binds) ? control.binds[0] : undefined;
  if (!firstBind) {
    return control.defaultValue;
  }
  const value = getValueByPath(props.parts, firstBind);
  return value === undefined ? control.defaultValue : value;
});

// 单值输入的草稿同步：只有不在编辑时才用外部值覆盖草稿。
watch(
  currentSingleValue,
  (value) => {
    if (singleDraftEditing.value) {
      return;
    }
    singleDraftValue.value = value ?? "";
  },
  { immediate: true }
);

// 多值输入的草稿同步：只有不在编辑时才用外部值覆盖草稿。
watch(
  currentMultiValue,
  (value) => {
    if (multiDraftEditing.value) {
      return;
    }
    multiDraftValue.value = value ?? "";
  },
  { immediate: true }
);

// 预设控件可选项。
const presetOptions = computed(() => props.control.presetOptions || []);

// 预设列表变化时，保证当前选中值有效。
watch(
  presetOptions,
  (options) => {
    if (!options.length) {
      presetSelection.value = "";
      return;
    }
    if (!options.some((option) => option.id === presetSelection.value)) {
      presetSelection.value = options[0].id;
    }
  },
  { immediate: true }
);

// 读取 range 配置项（min/max/step）。
function getRangeAttr(name) {
  return props.control?.range?.[name];
}

function toNumberOrFallback(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function countDecimals(value) {
  const text = String(value ?? "");
  if (!text.includes(".")) {
    return 0;
  }
  return text.split(".")[1].length;
}

function adjustNumericValue(rawValue, direction, rangeLike = {}) {
  const stepValue = toNumberOrFallback(rangeLike?.step, 1);
  const step = stepValue === 0 ? 1 : Math.abs(stepValue);
  const minRaw = rangeLike?.min;
  const maxRaw = rangeLike?.max;
  const min = Number.isFinite(Number(minRaw)) ? Number(minRaw) : null;
  const max = Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : null;

  const current = toNumberOrFallback(rawValue, 0);
  let next = current + direction * step;

  if (min !== null) {
    next = Math.max(min, next);
  }
  if (max !== null) {
    next = Math.min(max, next);
  }

  const decimals = Math.max(countDecimals(step), countDecimals(current));
  return Number(next.toFixed(Math.min(decimals, 8)));
}

// 将输入值按控件类型归一化为 number/boolean/string。
function normalizeInputValue(value, valueType, controlType) {
  if (controlType === "toggle") {
    return Boolean(value);
  }
  if (
    valueType === "number" ||
    valueType === "size" ||
    controlType === "number" ||
    controlType === "size" ||
    controlType === "slider"
  ) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (valueType === "boolean") {
    return Boolean(value);
  }
  return value;
}

// 生成单字段更新补丁。
function buildPatchForSingle(value) {
  return {
    [props.control.bind]: normalizeInputValue(value, props.control.valueType, props.control.controlType),
  };
}

// 生成多字段更新补丁：支持 mapper、select.patch、统一赋值三种模式。
function buildPatchForMulti(value) {
  if (typeof props.control.multiValueMapper === "function") {
    return props.control.multiValueMapper(value, props.parts) || {};
  }

  // select + options.patch 的场景，直接应用预设补丁。
  if (props.control.controlType === "select" && Array.isArray(props.control.options)) {
    const selected = props.control.options.find((option) => String(option.value) === String(value));
    if (selected?.patch && typeof selected.patch === "object") {
      return props.control.bind
        ? {
            ...selected.patch,
            [props.control.bind]: value,
          }
        : selected.patch;
    }
  }

  const patch = {};
  const normalized = normalizeInputValue(value, props.control.valueType, props.control.controlType);
  (props.control.binds || []).forEach((path) => {
    patch[path] = normalized;
  });
  return patch;
}

// 发出 patch 事件给父组件。
function emitPatch(patch) {
  emit("apply-patch", patch);
}

// 单值输入事件处理。
function onSingleDraftInput(event) {
  singleDraftEditing.value = true;
  singleDraftValue.value = event.target.value;
}

// 单值输入框在失焦时才提交修改。
function commitSingleDraft() {
  if (!singleDraftEditing.value) {
    return;
  }
  emitPatch(buildPatchForSingle(singleDraftValue.value));
  singleDraftEditing.value = false;
}

function onSingleDraftBlur() {
  commitSingleDraft();
}

function onSingleDraftEnter(event) {
  event.preventDefault();
  event.target.blur();
}

function onSingleStep(direction) {
  const baseValue = singleDraftEditing.value ? singleDraftValue.value : currentSingleValue.value;
  const nextValue = adjustNumericValue(baseValue, direction, {
    min: getRangeAttr("min"),
    max: getRangeAttr("max"),
    step: getRangeAttr("step"),
  });
  singleDraftValue.value = nextValue;
  singleDraftEditing.value = false;
  emitPatch(buildPatchForSingle(nextValue));
}

// 开关输入事件处理。
function onToggleInput(event) {
  emitPatch({
    [props.control.bind]: Boolean(event.target.checked),
  });
}

// 多值输入事件处理。
function onSingleImmediateInput(event) {
  emitPatch(buildPatchForSingle(event.target.value));
}

// 多值输入框在失焦时才提交修改。
function onMultiDraftInput(event) {
  multiDraftEditing.value = true;
  multiDraftValue.value = event.target.value;
}

function commitMultiDraft() {
  if (!multiDraftEditing.value) {
    return;
  }
  emitPatch(buildPatchForMulti(multiDraftValue.value));
  multiDraftEditing.value = false;
}

function onMultiDraftBlur() {
  commitMultiDraft();
}

function onMultiDraftEnter(event) {
  event.preventDefault();
  event.target.blur();
}

function onMultiImmediateInput(event) {
  emitPatch(buildPatchForMulti(event.target.value));
}

function onMultiStep(direction) {
  const baseValue = multiDraftEditing.value ? multiDraftValue.value : currentMultiValue.value;
  const nextValue = adjustNumericValue(baseValue, direction, {
    min: getRangeAttr("min"),
    max: getRangeAttr("max"),
    step: getRangeAttr("step"),
  });
  multiDraftValue.value = nextValue;
  multiDraftEditing.value = false;
  emitPatch(buildPatchForMulti(nextValue));
}

// 预设输入事件处理。
function onPresetInput(event) {
  const selectedPreset = presetOptions.value.find((preset) => preset.id === event.target.value);
  if (selectedPreset?.patch) {
    emitPatch(selectedPreset.patch);
  }
}

// 按 schema 生成新增项默认值。
function buildItemFromSchema(control) {
  const base = { ...(control.initialValue || {}) };
  const schema = control.itemSchema || {};

  Object.keys(schema).forEach((key) => {
    if (base[key] !== undefined) {
      return;
    }
    if (schema[key] === "number") {
      base[key] = 0;
    } else if (schema[key] === "boolean") {
      base[key] = false;
    } else {
      base[key] = "";
    }
  });

  return base;
}

// 触发“新增一项”。
function onAddAction() {
  emit("add-item", {
    targetCollection: props.control.targetCollection,
    item: buildItemFromSchema(props.control),
  });
}

// 触发“删除一项”。
function onRemoveAction() {
  if (removeSelection.value === "") {
    return;
  }
  emit("remove-item", {
    targetCollection: props.control.targetCollection,
    matcher: {
      rowKey: props.control.rowKey,
      value: removeSelection.value,
    },
  });
}

// 自动推断表格 schema（根据现有数据类型）。
function inferAutoSchema(rows) {
  const keys = new Set();
  const sampleTypeByKey = new Map();
  rows.forEach((item) => {
    Object.keys(item || {}).forEach((key) => {
      keys.add(key);
      if (!sampleTypeByKey.has(key)) {
        sampleTypeByKey.set(key, detectValueType(item?.[key]));
      }
    });
  });

  return Array.from(keys).map((key) => ({
    valueType: sampleTypeByKey.get(key) || "string",
    editable: (sampleTypeByKey.get(key) || "string") !== "array",
    key,
    label: key,
    hidden: false,
  }));
}

// 将自动推断 schema 与手工 schema 合并（手工优先覆盖）。
function mergeMixedSchema(autoSchema, manualSchema) {
  const map = new Map(autoSchema.map((entry) => [entry.key, { ...entry }]));

  (manualSchema || []).forEach((entry) => {
    if (map.has(entry.key)) {
      map.set(entry.key, {
        ...map.get(entry.key),
        ...entry,
      });
      return;
    }
    map.set(entry.key, {
      label: entry.key,
      valueType: "string",
      editable: true,
      hidden: false,
      ...entry,
    });
  });

  return Array.from(map.values());
}

// 计算最终表格列定义。
const tableColumns = computed(() => {
  if (props.control.controlType !== "table") {
    return [];
  }

  const rows = collection.value;
  const schemaSource = props.control.schemaSource || "auto";
  const manualSchema = Array.isArray(props.control.tableSchema) ? props.control.tableSchema : [];

  if (schemaSource === "manual") {
    return manualSchema.filter((column) => !column.hidden);
  }

  const autoSchema = inferAutoSchema(rows);
  if (schemaSource === "mixed") {
    return mergeMixedSchema(autoSchema, manualSchema).filter((column) => !column.hidden);
  }

  return autoSchema.filter((column) => !column.hidden);
});

function isArrayColumn(column) {
  return String(column?.valueType || "").toLowerCase() === "array";
}

function isArrayCell(row, column) {
  return Array.isArray(row?.[column?.key]) || isArrayColumn(column);
}

function formatArrayPreview(value) {
  if (!Array.isArray(value)) {
    return "";
  }
  const formatItem = (item) => {
    if (item == null) {
      return "null";
    }
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      return String(item);
    }
    if (Array.isArray(item)) {
      return "[...]";
    }
    return "{...}";
  };
  const limit = 4;
  const head = value.slice(0, limit).map((item) => formatItem(item)).join(", ");
  const suffix = value.length > limit ? ", ..." : "";
  return `[${head}${suffix}]`;
}

function formatReadonlyValue(value) {
  if (Array.isArray(value)) {
    return formatArrayPreview(value);
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "{...}";
    }
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function onArrayCellClick(rowIndex, column, row) {
  const rawValue = row?.[column?.key];
  if (!Array.isArray(rawValue)) {
    return;
  }
  activeArrayCell.value = {
    rowIndex,
    columnKey: column.key,
  };
  arrayItemDraftMap.value = {};
}

function getArrayItemDraftKey(rowIndex, columnKey, itemIndex) {
  return `${rowIndex}::${columnKey}::${itemIndex}`;
}

function getArrayItemDisplayValue(rowIndex, columnKey, itemIndex, fallbackValue) {
  const key = getArrayItemDraftKey(rowIndex, columnKey, itemIndex);
  if (Object.prototype.hasOwnProperty.call(arrayItemDraftMap.value, key)) {
    return arrayItemDraftMap.value[key];
  }
  return fallbackValue ?? "";
}

function onArrayItemDraftInput(rowIndex, columnKey, itemIndex, rawValue) {
  const key = getArrayItemDraftKey(rowIndex, columnKey, itemIndex);
  arrayItemDraftMap.value = {
    ...arrayItemDraftMap.value,
    [key]: rawValue,
  };
}

function clearArrayItemDraft(rowIndex, columnKey, itemIndex) {
  const key = getArrayItemDraftKey(rowIndex, columnKey, itemIndex);
  if (!Object.prototype.hasOwnProperty.call(arrayItemDraftMap.value, key)) {
    return;
  }
  const next = { ...arrayItemDraftMap.value };
  delete next[key];
  arrayItemDraftMap.value = next;
}

function normalizeArrayItemValue(rawValue, valueType) {
  if (valueType === "number") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (valueType === "boolean") {
    return Boolean(rawValue);
  }
  if (valueType === "color") {
    const text = String(rawValue || "").trim();
    return colorHexPattern.test(text) ? text : "#000000";
  }
  return rawValue == null ? "" : String(rawValue);
}

function commitArrayItemDraft(rowIndex, columnKey, itemIndex, valueType, fallbackRawValue = "") {
  const key = getArrayItemDraftKey(rowIndex, columnKey, itemIndex);
  const hasDraft = Object.prototype.hasOwnProperty.call(arrayItemDraftMap.value, key);
  const rawValue = hasDraft ? arrayItemDraftMap.value[key] : fallbackRawValue;
  emitPatch({
    [`${props.control.targetCollection}.${rowIndex}.${columnKey}.${itemIndex}`]:
      normalizeArrayItemValue(rawValue, valueType),
  });
  clearArrayItemDraft(rowIndex, columnKey, itemIndex);
}

function onArrayItemBlur(rowIndex, columnKey, itemIndex, valueType, event) {
  commitArrayItemDraft(
    rowIndex,
    columnKey,
    itemIndex,
    valueType,
    event?.target?.value ?? ""
  );
}

function onArrayItemEnter(event) {
  event.preventDefault();
  event.target.blur();
}

function onArrayItemBooleanChange(rowIndex, columnKey, itemIndex, checked) {
  emitPatch({
    [`${props.control.targetCollection}.${rowIndex}.${columnKey}.${itemIndex}`]: Boolean(checked),
  });
}

const activeArrayEditor = computed(() => {
  const active = activeArrayCell.value;
  if (!active) {
    return null;
  }
  const row = collection.value?.[active.rowIndex];
  if (!row) {
    return null;
  }
  const rawArray = row?.[active.columnKey];
  if (!Array.isArray(rawArray)) {
    return null;
  }
  const rowLabelKey = props.control.rowKey;
  const rowLabel = rowLabelKey
    ? String(row?.[rowLabelKey] ?? `Row ${active.rowIndex + 1}`)
    : `Row ${active.rowIndex + 1}`;

  return {
    rowIndex: active.rowIndex,
    columnKey: active.columnKey,
    rowLabel,
    title: `${active.columnKey} (${rowLabel})`,
    items: rawArray.map((item, index) => ({
      index,
      valueType: detectValueType(item),
      value: item,
    })),
  };
});

// 计算表格方向：固定值优先，其次读取 orientationKey，默认 row-major。
const tableOrientation = computed(() => {
  if (props.control.controlType !== "table") {
    return "row-major";
  }

  const orientation = props.control.tableOrientation || "auto";
  if (orientation !== "auto") {
    return orientation;
  }

  if (props.control.orientationKey) {
    const value = getValueByPath(props.parts, props.control.orientationKey);
    if (value === "row-major" || value === "column-major") {
      return value;
    }
  }

  return "row-major";
});

// 自动模式下确保 orientationKey 有默认值，避免状态为空。
watch(
  () => [props.control.controlType, props.control.tableOrientation, props.control.orientationKey],
  () => {
    if (props.control.controlType !== "table") {
      return;
    }
    if (props.control.tableOrientation !== "auto" || !props.control.orientationKey) {
      return;
    }
    const current = getValueByPath(props.parts, props.control.orientationKey);
    if (current === "row-major" || current === "column-major") {
      return;
    }
    setValueByPath(props.parts, props.control.orientationKey, "row-major");
  },
  { immediate: true }
);

watch(
  [collection, tableColumns],
  () => {
    if (!activeArrayCell.value) {
      return;
    }
    const row = collection.value?.[activeArrayCell.value.rowIndex];
    const columnExists = tableColumns.value.some((column) => column.key === activeArrayCell.value.columnKey);
    if (!row || !columnExists || !Array.isArray(row?.[activeArrayCell.value.columnKey])) {
      activeArrayCell.value = null;
      arrayItemDraftMap.value = {};
    }
  },
  { deep: true }
);

// 标准化表格单元格输入值。
function normalizeTableCellValue(rawValue, column) {
  return normalizeInputValue(rawValue, column.valueType, column.valueType);
}

// 表格单元格输入事件：转成 path patch。
function onTableCellInput(rowIndex, column, rawValue) {
  const path = `${props.control.targetCollection}.${rowIndex}.${column.key}`;
  emitPatch({
    [path]: normalizeTableCellValue(rawValue, column),
  });
}

function detectValueType(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (value && typeof value === "object") {
    return "object";
  }
  if (typeof value === "string" && colorHexPattern.test(value.trim())) {
    return "color";
  }
  return "string";
}

// 表格单元格编辑草稿：失焦时才提交到 parts。
function getTableCellDraftKey(rowIndex, columnKey) {
  return `${rowIndex}::${columnKey}`;
}

function getTableCellDisplayValue(rowIndex, column, row) {
  const key = getTableCellDraftKey(rowIndex, column.key);
  if (Object.prototype.hasOwnProperty.call(tableCellDraftMap.value, key)) {
    return tableCellDraftMap.value[key];
  }
  return row?.[column.key] ?? "";
}

function onTableCellDraftInput(rowIndex, column, rawValue) {
  const key = getTableCellDraftKey(rowIndex, column.key);
  tableCellDraftMap.value = {
    ...tableCellDraftMap.value,
    [key]: rawValue,
  };
}

function clearTableCellDraft(rowIndex, column) {
  const key = getTableCellDraftKey(rowIndex, column.key);
  if (!Object.prototype.hasOwnProperty.call(tableCellDraftMap.value, key)) {
    return;
  }
  const next = { ...tableCellDraftMap.value };
  delete next[key];
  tableCellDraftMap.value = next;
}

function commitTableCellDraft(rowIndex, column, fallbackRawValue = "") {
  const key = getTableCellDraftKey(rowIndex, column.key);
  const hasDraft = Object.prototype.hasOwnProperty.call(tableCellDraftMap.value, key);
  const rawValue = hasDraft ? tableCellDraftMap.value[key] : fallbackRawValue;
  onTableCellInput(rowIndex, column, rawValue);
  clearTableCellDraft(rowIndex, column);
}

function onTableCellBlur(rowIndex, column, event) {
  commitTableCellDraft(rowIndex, column, event?.target?.value ?? "");
}

function onTableCellEnter(event) {
  event.preventDefault();
  event.target.blur();
}

function onTableCellStep(rowIndex, column, row, direction) {
  const baseValue = getTableCellDisplayValue(rowIndex, column, row);
  const nextValue = adjustNumericValue(baseValue, direction, {
    min: column?.min,
    max: column?.max,
    step: column?.step ?? 1,
  });
  onTableCellInput(rowIndex, column, nextValue);
  clearTableCellDraft(rowIndex, column);
}

function clearHoldTimers() {
  if (holdStartTimer) {
    clearTimeout(holdStartTimer);
    holdStartTimer = null;
  }
  if (holdRepeatTimer) {
    clearInterval(holdRepeatTimer);
    holdRepeatTimer = null;
  }
}

function removeGlobalHoldListeners() {
  window.removeEventListener("pointerup", stopContinuousStep);
  window.removeEventListener("pointercancel", stopContinuousStep);
  window.removeEventListener("blur", stopContinuousStep);
}

function stopContinuousStep() {
  clearHoldTimers();
  removeGlobalHoldListeners();
  holdActiveKey = "";
}

function startContinuousStep(stepKey, stepFn) {
  stopContinuousStep();
  holdActiveKey = stepKey;
  stepFn();

  holdStartTimer = setTimeout(() => {
    if (holdActiveKey !== stepKey) {
      return;
    }
    holdRepeatTimer = setInterval(() => {
      if (holdActiveKey !== stepKey) {
        return;
      }
      stepFn();
    }, HOLD_REPEAT_MS);
  }, HOLD_START_DELAY_MS);

  window.addEventListener("pointerup", stopContinuousStep);
  window.addEventListener("pointercancel", stopContinuousStep);
  window.addEventListener("blur", stopContinuousStep);
}

function onStepPointerDown(event, stepKey, stepFn) {
  event.preventDefault();
  startContinuousStep(stepKey, stepFn);
}

function onStepPointerUp() {
  stopContinuousStep();
}

function onStepPointerLeave() {
  stopContinuousStep();
}

function onStepKeydown(event, stepFn) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  stepFn();
}

onBeforeUnmount(() => {
  stopContinuousStep();
});

// 表格“加行”操作。
function onTableAddRow() {
  emit("add-item", {
    targetCollection: props.control.targetCollection,
    item: buildItemFromSchema(props.control),
  });
}

// 表格“删行”操作：优先 rowKey 匹配，否则按索引。
function onTableRemoveRow(rowIndex, rowValue) {
  const rowKey = props.control.rowKey;
  emit("remove-item", {
    targetCollection: props.control.targetCollection,
    matcher: rowKey
      ? { rowKey, value: rowValue?.[rowKey] }
      : {
          index: rowIndex,
        },
  });
}

// 判断行级动作是否开启。
function isRowActionEnabled(action) {
  return Array.isArray(props.control.rowActions) && props.control.rowActions.includes(action);
}

function isNumberLikeControl(control) {
  const controlType = String(control?.controlType || "").toLowerCase();
  return controlType === "number" || controlType === "size";
}

function isNumberLikeColumn(column) {
  const valueType = String(column?.valueType || "").toLowerCase();
  return valueType === "number" || valueType === "size";
}
</script>

<template>
  <div v-if="isVisible" class="control-item">
    <div v-if="isUnsupported" class="unsupported">
      Unsupported control config
    </div>

    <template v-else>
      <div class="control-header">
        <div class="control-title">
          <div class="control-title-line">
            <label>{{ control.label }}</label>
            <span v-if="control.warningMessage" class="control-warning">⚠️ {{ control.warningMessage }}</span>
          </div>
        </div>
        <button
          v-if="control.expandable && control.detailSectionRef"
          type="button"
          class="expand-btn"
          @click="emit('toggle-detail', control.detailSectionRef)"
        >
          {{ isDetailExpanded ? "Hide Detail" : "Show Detail" }}
        </button>
      </div>

      <div
        v-if="control.operationType === 'update' && control.bindingMode === 'single' && isNumberLikeControl(control)"
        class="number-input-wrap"
      >
        <input
          class="no-spinner"
          type="number"
          :min="getRangeAttr('min')"
          :max="getRangeAttr('max')"
          :step="getRangeAttr('step')"
          :value="singleDraftValue"
          @input="onSingleDraftInput"
          @blur="onSingleDraftBlur"
          @keydown.enter="onSingleDraftEnter"
        />
        <div class="number-stepper">
          <button
            type="button"
            class="step-btn step-dec"
            @pointerdown="onStepPointerDown($event, `single_dec_${control.id}`, () => onSingleStep(-1))"
            @pointerup="onStepPointerUp"
            @pointerleave="onStepPointerLeave"
            @pointercancel="onStepPointerUp"
            @keydown="onStepKeydown($event, () => onSingleStep(-1))"
          >
            -
          </button>
          <button
            type="button"
            class="step-btn step-inc"
            @pointerdown="onStepPointerDown($event, `single_inc_${control.id}`, () => onSingleStep(1))"
            @pointerup="onStepPointerUp"
            @pointerleave="onStepPointerLeave"
            @pointercancel="onStepPointerUp"
            @keydown="onStepKeydown($event, () => onSingleStep(1))"
          >
            +
          </button>
        </div>
      </div>

      <div
        v-else-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'slider'"
        class="slider-wrap"
      >
        <input
          type="range"
          :min="getRangeAttr('min')"
          :max="getRangeAttr('max')"
          :step="getRangeAttr('step')"
          :value="currentSingleValue"
          @input="onSingleImmediateInput"
        />
        <span>{{ Number(currentSingleValue).toFixed(2) }}</span>
      </div>

      <input
        v-else-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'text'"
        type="text"
        :value="singleDraftValue"
        @input="onSingleDraftInput"
        @blur="onSingleDraftBlur"
        @keydown.enter="onSingleDraftEnter"
      />

      <input
        v-else-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'color'"
        type="color"
        :value="currentSingleValue"
        @input="onSingleImmediateInput"
      />

      <select
        v-else-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'select'"
        :value="currentSingleValue"
        @change="onSingleImmediateInput"
      >
        <option v-for="option in control.options" :key="String(option.value)" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <label
        v-else-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'toggle'"
        class="toggle-wrap"
      >
        <input type="checkbox" :checked="Boolean(currentSingleValue)" @change="onToggleInput" />
        <span>{{ Boolean(currentSingleValue) ? "On" : "Off" }}</span>
      </label>

      <div
        v-else-if="control.operationType === 'update' && control.bindingMode === 'multi' && isNumberLikeControl(control)"
        class="number-input-wrap"
      >
        <input
          class="no-spinner"
          type="number"
          :min="getRangeAttr('min')"
          :max="getRangeAttr('max')"
          :step="getRangeAttr('step')"
          :value="multiDraftValue"
          @input="onMultiDraftInput"
          @blur="onMultiDraftBlur"
          @keydown.enter="onMultiDraftEnter"
        />
        <div class="number-stepper">
          <button
            type="button"
            class="step-btn step-dec"
            @pointerdown="onStepPointerDown($event, `multi_dec_${control.id}`, () => onMultiStep(-1))"
            @pointerup="onStepPointerUp"
            @pointerleave="onStepPointerLeave"
            @pointercancel="onStepPointerUp"
            @keydown="onStepKeydown($event, () => onMultiStep(-1))"
          >
            -
          </button>
          <button
            type="button"
            class="step-btn step-inc"
            @pointerdown="onStepPointerDown($event, `multi_inc_${control.id}`, () => onMultiStep(1))"
            @pointerup="onStepPointerUp"
            @pointerleave="onStepPointerLeave"
            @pointercancel="onStepPointerUp"
            @keydown="onStepKeydown($event, () => onMultiStep(1))"
          >
            +
          </button>
        </div>
      </div>

      <div
        v-else-if="control.operationType === 'update' && control.bindingMode === 'multi' && control.controlType === 'slider'"
        class="slider-wrap"
      >
        <input
          type="range"
          :min="getRangeAttr('min')"
          :max="getRangeAttr('max')"
          :step="getRangeAttr('step')"
          :value="currentMultiValue"
          @input="onMultiImmediateInput"
        />
        <span>{{ Number(currentMultiValue).toFixed(2) }}</span>
      </div>

      <select
        v-else-if="control.operationType === 'update' && control.bindingMode === 'multi' && control.controlType === 'select'"
        :value="currentMultiValue"
        @change="onMultiImmediateInput"
      >
        <option v-for="option in control.options" :key="String(option.value)" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <select
        v-else-if="control.controlType === 'preset-select' && control.operationType === 'update' && control.bindingMode === 'preset'"
        v-model="presetSelection"
        @change="onPresetInput"
      >
        <option v-for="preset in presetOptions" :key="preset.id" :value="preset.id">
          {{ preset.label }}
        </option>
      </select>

      <button
        v-else-if="control.controlType === 'action' && control.operationType === 'add'"
        type="button"
        class="action-btn"
        @click="onAddAction"
      >
        {{ control.label }}
      </button>

      <div
        v-else-if="control.controlType === 'select-action' && control.operationType === 'remove'"
        class="select-action-wrap"
      >
        <select v-model="removeSelection">
          <option v-for="option in removeOptions" :key="String(option.value)" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <button type="button" class="danger-btn" @click="onRemoveAction">Remove</button>
      </div>

      <div v-else-if="control.controlType === 'table'" class="table-wrap">
        <div class="table-toolbar">
          <button v-if="isRowActionEnabled('add')" type="button" class="action-btn" @click="onTableAddRow">Add Row</button>
        </div>

        <table v-if="tableOrientation === 'row-major'">
          <thead>
            <tr>
              <th v-for="column in tableColumns" :key="column.key">{{ column.label || column.key }}</th>
              <th v-if="isRowActionEnabled('remove')">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in collection" :key="`${row?.[control.rowKey] ?? rowIndex}`">
              <td v-for="column in tableColumns" :key="column.key">
                <div v-if="column.editable !== false && isNumberLikeColumn(column)" class="number-input-wrap table-number-wrap">
                  <input
                    class="no-spinner"
                    type="number"
                    :value="getTableCellDisplayValue(rowIndex, column, row)"
                    @input="onTableCellDraftInput(rowIndex, column, $event.target.value)"
                    @blur="onTableCellBlur(rowIndex, column, $event)"
                    @keydown.enter="onTableCellEnter"
                  />
                  <div class="number-stepper table-number-stepper">
                    <button
                      type="button"
                      class="step-btn step-dec"
                      @pointerdown="onStepPointerDown($event, `table_row_dec_${rowIndex}_${column.key}`, () => onTableCellStep(rowIndex, column, row, -1))"
                      @pointerup="onStepPointerUp"
                      @pointerleave="onStepPointerLeave"
                      @pointercancel="onStepPointerUp"
                      @keydown="onStepKeydown($event, () => onTableCellStep(rowIndex, column, row, -1))"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      class="step-btn step-inc"
                      @pointerdown="onStepPointerDown($event, `table_row_inc_${rowIndex}_${column.key}`, () => onTableCellStep(rowIndex, column, row, 1))"
                      @pointerup="onStepPointerUp"
                      @pointerleave="onStepPointerLeave"
                      @pointercancel="onStepPointerUp"
                      @keydown="onStepKeydown($event, () => onTableCellStep(rowIndex, column, row, 1))"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  v-else-if="isArrayCell(row, column)"
                  type="button"
                  class="array-cell-btn"
                  @click="onArrayCellClick(rowIndex, column, row)"
                >
                  {{ formatArrayPreview(row?.[column.key]) || "[]" }}
                </button>
                <input
                  v-else-if="column.editable !== false"
                  :type="column.valueType === 'color' ? 'color' : 'text'"
                  :value="getTableCellDisplayValue(rowIndex, column, row)"
                  @input="onTableCellDraftInput(rowIndex, column, $event.target.value)"
                  @blur="onTableCellBlur(rowIndex, column, $event)"
                  @keydown.enter="onTableCellEnter"
                />
                <span v-else>{{ formatReadonlyValue(row?.[column.key]) }}</span>
              </td>
              <td v-if="isRowActionEnabled('remove')">
                <button type="button" class="danger-btn" @click="onTableRemoveRow(rowIndex, row)">Remove</button>
              </td>
            </tr>
          </tbody>
        </table>

        <table v-else>
          <thead>
            <tr>
              <th>Field</th>
              <th v-for="(row, rowIndex) in collection" :key="`${row?.[control.rowKey] ?? rowIndex}`">
                {{ row?.[control.rowKey] ?? `Item ${rowIndex + 1}` }}
                <button
                  v-if="isRowActionEnabled('remove')"
                  type="button"
                  class="danger-btn mini"
                  @click="onTableRemoveRow(rowIndex, row)"
                >
                  x
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="column in tableColumns" :key="column.key">
              <th>{{ column.label || column.key }}</th>
              <td v-for="(row, rowIndex) in collection" :key="`${column.key}-${rowIndex}`">
                <div v-if="column.editable !== false && isNumberLikeColumn(column)" class="number-input-wrap table-number-wrap">
                  <input
                    class="no-spinner"
                    type="number"
                    :value="getTableCellDisplayValue(rowIndex, column, row)"
                    @input="onTableCellDraftInput(rowIndex, column, $event.target.value)"
                    @blur="onTableCellBlur(rowIndex, column, $event)"
                    @keydown.enter="onTableCellEnter"
                  />
                  <div class="number-stepper table-number-stepper">
                    <button
                      type="button"
                      class="step-btn step-dec"
                      @pointerdown="onStepPointerDown($event, `table_col_dec_${rowIndex}_${column.key}`, () => onTableCellStep(rowIndex, column, row, -1))"
                      @pointerup="onStepPointerUp"
                      @pointerleave="onStepPointerLeave"
                      @pointercancel="onStepPointerUp"
                      @keydown="onStepKeydown($event, () => onTableCellStep(rowIndex, column, row, -1))"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      class="step-btn step-inc"
                      @pointerdown="onStepPointerDown($event, `table_col_inc_${rowIndex}_${column.key}`, () => onTableCellStep(rowIndex, column, row, 1))"
                      @pointerup="onStepPointerUp"
                      @pointerleave="onStepPointerLeave"
                      @pointercancel="onStepPointerUp"
                      @keydown="onStepKeydown($event, () => onTableCellStep(rowIndex, column, row, 1))"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  v-else-if="isArrayCell(row, column)"
                  type="button"
                  class="array-cell-btn"
                  @click="onArrayCellClick(rowIndex, column, row)"
                >
                  {{ formatArrayPreview(row?.[column.key]) || "[]" }}
                </button>
                <input
                  v-else-if="column.editable !== false"
                  :type="column.valueType === 'color' ? 'color' : 'text'"
                  :value="getTableCellDisplayValue(rowIndex, column, row)"
                  @input="onTableCellDraftInput(rowIndex, column, $event.target.value)"
                  @blur="onTableCellBlur(rowIndex, column, $event)"
                  @keydown.enter="onTableCellEnter"
                />
                <span v-else>{{ formatReadonlyValue(row?.[column.key]) }}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="activeArrayEditor" class="array-editor-wrap">
          <div class="array-editor-header">
            <span class="array-editor-title">{{ activeArrayEditor.title }}</span>
          </div>
          <div class="array-editor-grid">
            <div
              v-for="item in activeArrayEditor.items"
              :key="`${activeArrayEditor.rowIndex}_${activeArrayEditor.columnKey}_${item.index}`"
              class="array-editor-item"
            >
              <label class="array-editor-label">[{{ item.index }}]</label>

              <input
                v-if="item.valueType === 'number'"
                class="no-spinner"
                type="number"
                :value="
                  getArrayItemDisplayValue(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    item.value
                  )
                "
                @input="
                  onArrayItemDraftInput(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    $event.target.value
                  )
                "
                @blur="
                  onArrayItemBlur(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    item.valueType,
                    $event
                  )
                "
                @keydown.enter="onArrayItemEnter"
              />

              <input
                v-else-if="item.valueType === 'color'"
                type="color"
                :value="
                  getArrayItemDisplayValue(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    item.value
                  )
                "
                @input="
                  onArrayItemDraftInput(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    $event.target.value
                  )
                "
                @blur="
                  onArrayItemBlur(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    item.valueType,
                    $event
                  )
                "
              />

              <label v-else-if="item.valueType === 'boolean'" class="toggle-wrap">
                <input
                  type="checkbox"
                  :checked="Boolean(item.value)"
                  @change="
                    onArrayItemBooleanChange(
                      activeArrayEditor.rowIndex,
                      activeArrayEditor.columnKey,
                      item.index,
                      $event.target.checked
                    )
                  "
                />
                <span>{{ Boolean(item.value) ? "On" : "Off" }}</span>
              </label>

              <input
                v-else
                type="text"
                :value="
                  getArrayItemDisplayValue(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    item.value
                  )
                "
                @input="
                  onArrayItemDraftInput(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    $event.target.value
                  )
                "
                @blur="
                  onArrayItemBlur(
                    activeArrayEditor.rowIndex,
                    activeArrayEditor.columnKey,
                    item.index,
                    item.valueType,
                    $event
                  )
                "
                @keydown.enter="onArrayItemEnter"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-else class="unsupported">
        Unsupported control config
      </div>
    </template>
  </div>
</template>

<style scoped>
.control-item {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
  background: #f9fafb;
}

.control-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.control-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.control-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.control-title label {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.control-warning {
  font-size: 12px;
  color: #b45309;
  font-weight: 500;
}

.expand-btn,
.action-btn,
.danger-btn {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  background: #ffffff;
  cursor: pointer;
}

.danger-btn {
  color: #b91c1c;
  border-color: #fecaca;
}

.danger-btn.mini {
  margin-left: 6px;
  padding: 2px 6px;
  font-size: 11px;
}

input,
select {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 7px 8px;
  font-size: 13px;
  background: #ffffff;
}

.number-input-wrap {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.number-input-wrap input {
  flex: 1;
  min-width: 0;
}

.number-stepper {
  width: 56px;
  display: flex;
  gap: 4px;
}

.step-btn {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.step-btn:active {
  transform: translateY(1px);
}

.step-dec {
  color: #991b1b;
}

.step-inc {
  color: #166534;
}

.no-spinner::-webkit-outer-spin-button,
.no-spinner::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.no-spinner[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

.toggle-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.toggle-wrap input {
  width: auto;
}

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider-wrap span {
  min-width: 38px;
  text-align: right;
  font-size: 12px;
  color: #475569;
}

.select-action-wrap {
  display: flex;
  gap: 8px;
}

.table-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.array-cell-btn {
  width: 100%;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  padding: 6px 8px;
  text-align: left;
  cursor: pointer;
}

.array-cell-btn:hover {
  background: #eef2ff;
  border-color: #93c5fd;
}

.array-editor-wrap {
  border: 1px solid #dbeafe;
  background: #f8fbff;
  border-radius: 10px;
  padding: 10px;
}

.array-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.array-editor-title {
  font-size: 12px;
  font-weight: 600;
  color: #1e3a8a;
}

.array-editor-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.array-editor-item {
  min-width: 160px;
  max-width: 260px;
  flex: 1 1 180px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.array-editor-label {
  font-size: 11px;
  color: #475569;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
}

th,
td {
  border: 1px solid #e5e7eb;
  padding: 6px;
  font-size: 12px;
  text-align: left;
  vertical-align: top;
}

td input {
  font-size: 12px;
  padding: 6px;
}

.table-number-wrap {
  gap: 4px;
}

.table-number-stepper {
  width: 44px;
}

.unsupported {
  color: #b91c1c;
  font-size: 13px;
}
</style>
