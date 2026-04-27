<script setup>
import { computed, ref, watch } from "vue";
import ControlRenderer from "./ControlRenderer.vue";
import { addItemToCollection, removeItemFromCollection } from "../utils/collectionUtils";
import { setValueByPath } from "../utils/pathUtils";
import { getUnsupportedControlKeySet, validatePanelSpec } from "../utils/panelSpecValidator";

const props = defineProps({
  panelSpec: {
    type: Object,
    required: true,
  },
  parts: {
    type: Object,
    required: true,
  },
  panelGroups: {
    type: Array,
    default: () => [],
  },
});

const expandedDetailSections = ref(new Set());
const activeGroupId = ref("");

// 规范化面板分组输入，保证每个分组都可安全渲染。
const normalizedPanelGroups = computed(() => {
  return (props.panelGroups || [])
    .filter((group) => group && typeof group === "object")
    .map((group, index) => {
      const id = String(group.id || `panel_group_${index + 1}`);
      const label = String(group.label || `Intent ${index + 1}`);
      const panelSpec = group.panelSpec && typeof group.panelSpec === "object" ? group.panelSpec : null;
      return { id, label, panelSpec };
    })
    .filter((group) => group.panelSpec);
});

// 当分组变化时，自动选择第一个可用分组。
watch(
  normalizedPanelGroups,
  (groups) => {
    if (!groups.length) {
      activeGroupId.value = "";
      return;
    }
    if (groups.some((group) => group.id === activeGroupId.value)) {
      return;
    }
    activeGroupId.value = groups[0].id;
  },
  { immediate: true }
);

// 当前选中的分组；若无分组则回退到单 panelSpec 模式。
const activePanelGroup = computed(() => {
  const groups = normalizedPanelGroups.value;
  if (!groups.length) {
    return null;
  }
  return groups.find((group) => group.id === activeGroupId.value) || groups[0];
});

const resolvedPanelSpec = computed(() => {
  if (activePanelGroup.value?.panelSpec) {
    return activePanelGroup.value.panelSpec;
  }
  return props.panelSpec || {};
});

// 校验当前面板规格，未支持控件将以安全降级方式跳过。
const validationResult = computed(() => validatePanelSpec(resolvedPanelSpec.value));
const unsupportedControlKeys = computed(() => getUnsupportedControlKeySet(validationResult.value.issues));

// 构建 sectionId -> section 的索引映射，供明细折叠与高亮查询。
const sectionMap = computed(() => {
  const map = new Map();
  (resolvedPanelSpec.value.sections || []).forEach((section) => {
    map.set(section.sectionId, section);
  });
  return map;
});

// 面板规格异常时输出警告，便于调试配置问题。
watch(
  validationResult,
  (result) => {
    if (!result.issues.length) {
      return;
    }
    result.issues.forEach((issue) => {
      const location = [issue.sectionId, issue.controlId].filter(Boolean).join(" / ");
      const prefix = location ? `[PanelSpec] ${location}:` : "[PanelSpec]";
      console.warn(`${prefix} ${issue.message}`);
    });
  },
  { immediate: true }
);

// 同步默认展开项与 uiState 中的展开项。
watch(
  () => [resolvedPanelSpec.value.sections, resolvedPanelSpec.value.uiState?.expandedSections],
  ([sections, expandedSections]) => {
    const defaultExpanded = new Set();
    (sections || []).forEach((section) => {
      (section.controls || []).forEach((control) => {
        if (control.expandable && control.expandedByDefault && control.detailSectionRef) {
          defaultExpanded.add(control.detailSectionRef);
        }
      });
    });
    (expandedSections || []).forEach((sectionId) => {
      if (sectionMap.value.has(sectionId)) {
        defaultExpanded.add(sectionId);
      }
    });
    expandedDetailSections.value = defaultExpanded;
  },
  { immediate: true }
);

// 组织渲染块：主 section + 已展开的 detail section。
const renderSectionBlocks = computed(() => {
  const sections = resolvedPanelSpec.value.sections || [];
  const attachedDetailIds = new Set();
  const blocks = [];

  sections.forEach((section) => {
    if (section.priority === "detail") {
      return;
    }

    const detailSections = [];
    (section.controls || []).forEach((control) => {
      if (!control.expandable || !control.detailSectionRef) {
        return;
      }
      if (!expandedDetailSections.value.has(control.detailSectionRef)) {
        return;
      }
      const detailSection = sectionMap.value.get(control.detailSectionRef);
      if (!detailSection) {
        return;
      }
      if (detailSections.some((item) => item.sectionId === detailSection.sectionId)) {
        return;
      }
      detailSections.push(detailSection);
      attachedDetailIds.add(detailSection.sectionId);
    });

    blocks.push({
      section,
      detailSections,
    });
  });

  sections.forEach((section) => {
    if (section.priority !== "detail") {
      return;
    }
    if (!expandedDetailSections.value.has(section.sectionId)) {
      return;
    }
    if (attachedDetailIds.has(section.sectionId)) {
      return;
    }
    blocks.push({
      section,
      detailSections: [],
    });
  });

  return blocks;
});

// 应用控件 patch 到共享 parts 上。
function applyPatch(patch) {
  if (!patch || typeof patch !== "object") {
    return;
  }

  Object.entries(patch).forEach(([path, value]) => {
    setValueByPath(props.parts, path, value);
  });
}

// 集合控件：新增条目。
function onAddItem(payload) {
  if (!payload?.targetCollection) {
    return;
  }
  addItemToCollection(props.parts, payload.targetCollection, payload.item || {});
}

// 集合控件：删除条目。
function onRemoveItem(payload) {
  if (!payload?.targetCollection) {
    return;
  }
  removeItemFromCollection(props.parts, payload.targetCollection, payload.matcher);
}

// 展开/收起 detail section。
function toggleDetailSection(sectionId) {
  if (!sectionMap.value.has(sectionId)) {
    return;
  }
  const next = new Set(expandedDetailSections.value);
  if (next.has(sectionId)) {
    next.delete(sectionId);
  } else {
    next.add(sectionId);
  }
  expandedDetailSections.value = next;
}

// 判断控件是否属于未支持类型。
function isUnsupported(sectionId, controlId) {
  return unsupportedControlKeys.value.has(`${sectionId}::${controlId}`);
}

// 当前 block 是否处于高亮态。
function isBlockHighlighted(block) {
  const highlightedSectionId = resolvedPanelSpec.value?.uiState?.highlightedSectionId;
  if (!highlightedSectionId) {
    return false;
  }
  if (block.section.sectionId === highlightedSectionId) {
    return true;
  }
  return block.detailSections.some((section) => section.sectionId === highlightedSectionId);
}

function switchPanelGroup(groupId) {
  activeGroupId.value = String(groupId || "");
}

function isGroupActive(groupId) {
  return activeGroupId.value === groupId;
}
</script>

<template>
  <section class="control-panel panel">
    <header class="panel-header">
      <h2>{{ resolvedPanelSpec.title }}</h2>
      <div v-if="normalizedPanelGroups.length > 1" class="group-switcher" role="tablist" aria-label="Panel groups">
        <button
          v-for="group in normalizedPanelGroups"
          :key="group.id"
          type="button"
          class="group-chip"
          :class="{ active: isGroupActive(group.id) }"
          @click="switchPanelGroup(group.id)"
        >
          {{ group.label }}
        </button>
      </div>
    </header>

    <div v-if="!validationResult.isValid" class="fallback-warning">
      PanelSpec has invalid fields. Unsupported controls are skipped safely.
    </div>

    <div class="section-list">
      <section
        v-for="block in renderSectionBlocks"
        :key="block.section.sectionId"
        class="spec-section"
        :class="{ highlighted: isBlockHighlighted(block) }"
      >
        <header class="section-header">
          <h3>{{ block.section.title }}</h3>
        </header>

        <div class="controls-list">
          <ControlRenderer
            v-for="control in block.section.controls"
            :key="control.id"
            :control="control"
            :parts="parts"
            :is-unsupported="isUnsupported(block.section.sectionId, control.id)"
            :is-detail-expanded="Boolean(control.detailSectionRef && expandedDetailSections.has(control.detailSectionRef))"
            @apply-patch="applyPatch"
            @add-item="onAddItem"
            @remove-item="onRemoveItem"
            @toggle-detail="toggleDetailSection"
          />
        </div>

        <div v-for="detailSection in block.detailSections" :key="detailSection.sectionId" class="detail-section">
          <header class="section-header detail-header">
            <h4>{{ detailSection.title }}</h4>
          </header>
          <div class="controls-list detail-controls">
            <ControlRenderer
              v-for="control in detailSection.controls"
              :key="control.id"
              :control="control"
              :parts="parts"
              :is-unsupported="isUnsupported(detailSection.sectionId, control.id)"
              :is-detail-expanded="Boolean(control.detailSectionRef && expandedDetailSections.has(control.detailSectionRef))"
              @apply-patch="applyPatch"
              @add-item="onAddItem"
              @remove-item="onRemoveItem"
              @toggle-detail="toggleDetailSection"
            />
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  flex: 0 0 auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.group-switcher {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.group-chip {
  flex: 0 0 auto;
  border: 1px solid #d1d5db;
  background: #f8fafc;
  color: #334155;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  white-space: nowrap;
}

.group-chip.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1e3a8a;
}

.fallback-warning {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-size: 12px;
}

.section-list {
  margin-top: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spec-section {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
}

.spec-section.highlighted {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.section-header h3 {
  margin: 0;
  font-size: 14px;
}

.controls-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #dbeafe;
}

.detail-header h4 {
  margin: 0;
  font-size: 13px;
  color: #1e3a8a;
}

.detail-controls {
  margin-top: 8px;
}
</style>
