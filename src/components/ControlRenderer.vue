<script setup>
import { computed, ref, watch } from "vue";
import { getCollectionByPath } from "../utils/collectionUtils";
import { getValueByPath } from "../utils/pathUtils";

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

const isVisible = computed(() => {
  const condition = props.control.visibilityCondition;
  if (!condition) {
    return true;
  }
  const currentValue = getValueByPath(props.parts, condition.path);
  return currentValue === condition.equals;
});

const collection = computed(() => {
  if (!props.control.targetCollection) {
    return [];
  }
  return getCollectionByPath(props.parts, props.control.targetCollection);
});

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

const presetOptions = computed(() => props.control.presetOptions || []);

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

function getRangeAttr(name) {
  return props.control?.range?.[name];
}

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

function buildPatchForSingle(value) {
  return {
    [props.control.bind]: normalizeInputValue(value, props.control.valueType, props.control.controlType),
  };
}

function buildPatchForMulti(value) {
  if (typeof props.control.multiValueMapper === "function") {
    return props.control.multiValueMapper(value, props.parts) || {};
  }

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

function emitPatch(patch) {
  emit("apply-patch", patch);
}

function onSingleInput(event) {
  emitPatch(buildPatchForSingle(event.target.value));
}

function onToggleInput(event) {
  emitPatch({
    [props.control.bind]: Boolean(event.target.checked),
  });
}

function onMultiInput(event) {
  emitPatch(buildPatchForMulti(event.target.value));
}

function onPresetInput(event) {
  const selectedPreset = presetOptions.value.find((preset) => preset.id === event.target.value);
  if (selectedPreset?.patch) {
    emitPatch(selectedPreset.patch);
  }
}

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

function onAddAction() {
  emit("add-item", {
    targetCollection: props.control.targetCollection,
    item: buildItemFromSchema(props.control),
  });
}

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

function inferAutoSchema(rows) {
  const keys = new Set();
  rows.forEach((item) => {
    Object.keys(item || {}).forEach((key) => keys.add(key));
  });

  return Array.from(keys).map((key) => ({
    key,
    label: key,
    valueType: "string",
    editable: true,
    hidden: false,
  }));
}

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

function normalizeTableCellValue(rawValue, column) {
  return normalizeInputValue(rawValue, column.valueType, column.valueType);
}

function onTableCellInput(rowIndex, column, rawValue) {
  const path = `${props.control.targetCollection}.${rowIndex}.${column.key}`;
  emitPatch({
    [path]: normalizeTableCellValue(rawValue, column),
  });
}

function onTableAddRow() {
  emit("add-item", {
    targetCollection: props.control.targetCollection,
    item: buildItemFromSchema(props.control),
  });
}

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
          <label>{{ control.label }}</label>
          <small v-if="control.description">{{ control.description }}</small>
          <small v-if="control.impactDescription" class="impact">{{ control.impactDescription }}</small>
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
          <small>Orientation: {{ tableOrientation }}</small>
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

.control-title label {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.control-title small {
  color: #6b7280;
  font-size: 12px;
}

.impact {
  color: #1d4ed8;
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
