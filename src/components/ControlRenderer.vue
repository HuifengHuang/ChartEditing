<script setup>
import { computed, ref, watch } from "vue";
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

// 将输入值按控件类型归一化为 number/boolean/string。
function normalizeInputValue(value, valueType, controlType) {
  if (controlType === "toggle") {
    return Boolean(value);
  }
  if (valueType === "number" || controlType === "number" || controlType === "slider") {
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
function onSingleInput(event) {
  emitPatch(buildPatchForSingle(event.target.value));
}

// 开关输入事件处理。
function onToggleInput(event) {
  emitPatch({
    [props.control.bind]: Boolean(event.target.checked),
  });
}

// 多值输入事件处理。
function onMultiInput(event) {
  emitPatch(buildPatchForMulti(event.target.value));
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
  const colorHexPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

  // 根据样本值推断字段类型，优先 number/boolean/color。
  function detectValueType(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return "number";
    }
    if (typeof value === "boolean") {
      return "boolean";
    }
    if (typeof value === "string" && colorHexPattern.test(value.trim())) {
      return "color";
    }
    return "string";
  }

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
    key,
    label: key,
    valueType: sampleTypeByKey.get(key) || "string",
    editable: true,
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

      <input
        v-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'number'"
        type="number"
        :min="getRangeAttr('min')"
        :max="getRangeAttr('max')"
        :step="getRangeAttr('step')"
        :value="currentSingleValue"
        @input="onSingleInput"
      />

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
          @input="onSingleInput"
        />
        <span>{{ Number(currentSingleValue).toFixed(2) }}</span>
      </div>

      <input
        v-else-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'text'"
        type="text"
        :value="currentSingleValue"
        @input="onSingleInput"
      />

      <input
        v-else-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'color'"
        type="color"
        :value="currentSingleValue"
        @input="onSingleInput"
      />

      <select
        v-else-if="control.operationType === 'update' && control.bindingMode === 'single' && control.controlType === 'select'"
        :value="currentSingleValue"
        @change="onSingleInput"
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

      <input
        v-else-if="control.operationType === 'update' && control.bindingMode === 'multi' && control.controlType === 'number'"
        type="number"
        :min="getRangeAttr('min')"
        :max="getRangeAttr('max')"
        :step="getRangeAttr('step')"
        :value="currentMultiValue"
        @input="onMultiInput"
      />

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
          @input="onMultiInput"
        />
        <span>{{ Number(currentMultiValue).toFixed(2) }}</span>
      </div>

      <select
        v-else-if="control.operationType === 'update' && control.bindingMode === 'multi' && control.controlType === 'select'"
        :value="currentMultiValue"
        @change="onMultiInput"
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
                <input
                  v-if="column.editable !== false"
                  :type="column.valueType === 'number' ? 'number' : column.valueType === 'color' ? 'color' : 'text'"
                  :value="row?.[column.key]"
                  @input="onTableCellInput(rowIndex, column, $event.target.value)"
                />
                <span v-else>{{ row?.[column.key] }}</span>
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
                <input
                  v-if="column.editable !== false"
                  :type="column.valueType === 'number' ? 'number' : column.valueType === 'color' ? 'color' : 'text'"
                  :value="row?.[column.key]"
                  @input="onTableCellInput(rowIndex, column, $event.target.value)"
                />
                <span v-else>{{ row?.[column.key] }}</span>
              </td>
            </tr>
          </tbody>
        </table>
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

.unsupported {
  color: #b91c1c;
  font-size: 13px;
}
</style>
