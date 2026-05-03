<script setup>
import { computed, nextTick, ref, watch } from "vue";
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
const emit = defineEmits(["remove-group"]);

const selectedGroupId = ref("");
const collapsedGroupIds = ref(new Set());
const expandedDetailByGroup = ref(new Map());
const selectedPresetIdByGroup = ref(new Map());
const panelRootRef = ref(null);

function normalizePanelSpec(value) {
  return value && typeof value === "object" ? value : { sections: [], uiState: {} };
}

function buildSectionMap(panelSpec) {
  const map = new Map();
  (panelSpec.sections || []).forEach((section) => {
    map.set(section.sectionId, section);
  });
  return map;
}

function buildDefaultExpandedDetailSet(panelSpec, sectionMap) {
  const expanded = new Set();
  (panelSpec.sections || []).forEach((section) => {
    (section.controls || []).forEach((control) => {
      if (control.expandable && control.expandedByDefault && control.detailSectionRef) {
        expanded.add(control.detailSectionRef);
      }
    });
  });
  (panelSpec.uiState?.expandedSections || []).forEach((sectionId) => {
    if (sectionMap.has(sectionId)) {
      expanded.add(sectionId);
    }
  });
  return expanded;
}

function buildRenderSectionBlocks(panelSpec, expandedDetailSet, sectionMap) {
  const sections = panelSpec.sections || [];
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
      if (!expandedDetailSet.has(control.detailSectionRef)) {
        return;
      }
      const detailSection = sectionMap.get(control.detailSectionRef);
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
    if (!expandedDetailSet.has(section.sectionId)) {
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
}

const normalizedPanelGroups = computed(() => {
  return (props.panelGroups || [])
    .filter((group) => group && typeof group === "object")
    .map((group, index) => {
      const id = String(group.id || `panel_group_${index + 1}`);
      const label = String(group.label || `Intent ${index + 1}`);
      const panelSpec = normalizePanelSpec(group.panelSpec);
      const designPresets = Array.isArray(group.designPresets)
        ? group.designPresets
            .map((preset, presetIndex) => ({
              id: String(preset?.id || `design_preset_${presetIndex + 1}`),
              label: String(preset?.label || `Preset ${presetIndex + 1}`),
              patch: preset?.patch && typeof preset.patch === "object" ? preset.patch : {},
              thumbnailDataUrl: String(preset?.thumbnailDataUrl || ""),
            }))
            .filter((preset) => Object.keys(preset.patch).length > 0)
        : [];
      return { id, label, panelSpec, designPresets };
    });
});

const displayGroups = computed(() => {
  return normalizedPanelGroups.value;
});

const panelTitle = computed(() => {
  const fromProps = String(props.panelSpec?.title || "").trim();
  if (fromProps) {
    return fromProps;
  }
  const first = displayGroups.value[0];
  return String(first?.panelSpec?.title || "Visual Panels").trim() || "Visual Panels";
});

const groupMetaMap = computed(() => {
  const map = new Map();
  displayGroups.value.forEach((group) => {
    const validation = validatePanelSpec(group.panelSpec);
    const unsupported = getUnsupportedControlKeySet(validation.issues);
    const sectionMap = buildSectionMap(group.panelSpec);
    map.set(group.id, {
      validation,
      unsupported,
      sectionMap,
    });
  });
  return map;
});

watch(
  displayGroups,
  (groups) => {
    const groupIdSet = new Set(groups.map((group) => group.id));

    if (!groups.length) {
      selectedGroupId.value = "";
      collapsedGroupIds.value = new Set();
      expandedDetailByGroup.value = new Map();
      selectedPresetIdByGroup.value = new Map();
      return;
    }

    if (!groupIdSet.has(selectedGroupId.value)) {
      selectedGroupId.value = groups[0].id;
    }

    const nextCollapsed = new Set();
    collapsedGroupIds.value.forEach((groupId) => {
      if (groupIdSet.has(groupId)) {
        nextCollapsed.add(groupId);
      }
    });
    collapsedGroupIds.value = nextCollapsed;

    const nextExpandedDetailByGroup = new Map();
    const nextSelectedPresetMap = new Map();
    groups.forEach((group) => {
      const cached = expandedDetailByGroup.value.get(group.id);
      if (cached instanceof Set) {
        nextExpandedDetailByGroup.set(group.id, new Set(cached));
      } else {
        const sectionMap = buildSectionMap(group.panelSpec);
        nextExpandedDetailByGroup.set(
          group.id,
          buildDefaultExpandedDetailSet(group.panelSpec, sectionMap)
        );
      }

      const currentPresetId = selectedPresetIdByGroup.value.get(group.id);
      const hasCurrentPreset = group.designPresets.some((preset) => preset.id === currentPresetId);
      if (hasCurrentPreset) {
        nextSelectedPresetMap.set(group.id, currentPresetId);
      } else if (group.designPresets.length) {
        nextSelectedPresetMap.set(group.id, group.designPresets[0].id);
      }
    });
    expandedDetailByGroup.value = nextExpandedDetailByGroup;
    selectedPresetIdByGroup.value = nextSelectedPresetMap;
  },
  { immediate: true }
);

watch(
  groupMetaMap,
  (map) => {
    map.forEach((meta) => {
      if (!meta.validation.issues.length) {
        return;
      }
      meta.validation.issues.forEach((issue) => {
        const location = [issue.sectionId, issue.controlId].filter(Boolean).join(" / ");
        const prefix = location ? `[PanelSpec] ${location}:` : "[PanelSpec]";
        console.warn(`${prefix} ${issue.message}`);
      });
    });
  },
  { immediate: true }
);

function getMeta(groupId) {
  return groupMetaMap.value.get(groupId) || {
    validation: { isValid: true, issues: [] },
    unsupported: new Set(),
    sectionMap: new Map(),
  };
}

function getExpandedDetailSet(groupId) {
  const set = expandedDetailByGroup.value.get(groupId);
  return set instanceof Set ? set : new Set();
}

function getRenderSectionBlocks(group) {
  const meta = getMeta(group.id);
  return buildRenderSectionBlocks(group.panelSpec, getExpandedDetailSet(group.id), meta.sectionMap);
}

function isUnsupported(groupId, sectionId, controlId) {
  return getMeta(groupId).unsupported.has(`${sectionId}::${controlId}`);
}

function isBlockHighlighted(group, block) {
  const highlightedSectionId = group.panelSpec?.uiState?.highlightedSectionId;
  if (!highlightedSectionId) {
    return false;
  }
  if (highlightedSectionId === "recommendation_presets") {
    return false;
  }
  if (block.section.sectionId === highlightedSectionId) {
    return true;
  }
  return block.detailSections.some((section) => section.sectionId === highlightedSectionId);
}

function isGroupCollapsed(groupId) {
  return collapsedGroupIds.value.has(groupId);
}

function toggleGroupCollapsed(groupId) {
  const next = new Set(collapsedGroupIds.value);
  if (next.has(groupId)) {
    next.delete(groupId);
  } else {
    next.add(groupId);
  }
  collapsedGroupIds.value = next;
}

function selectGroup(groupId) {
  selectedGroupId.value = String(groupId || "");
}

function isGroupSelected(groupId) {
  return selectedGroupId.value === groupId;
}

function isDesignPresetSelected(groupId, presetId) {
  return selectedPresetIdByGroup.value.get(groupId) === presetId;
}

function onRemoveGroup(groupId) {
  const normalizedGroupId = String(groupId || "").trim();
  if (!normalizedGroupId) {
    return;
  }
  emit("remove-group", { groupId: normalizedGroupId });
}

function toggleDetailSection(groupId, sectionId) {
  const meta = getMeta(groupId);
  if (!meta.sectionMap.has(sectionId)) {
    return;
  }

  const nextMap = new Map(expandedDetailByGroup.value);
  const currentSet = getExpandedDetailSet(groupId);
  const nextSet = new Set(currentSet);
  if (nextSet.has(sectionId)) {
    nextSet.delete(sectionId);
  } else {
    nextSet.add(sectionId);
  }
  nextMap.set(groupId, nextSet);
  expandedDetailByGroup.value = nextMap;
}

function applyPatch(patch) {
  if (!patch || typeof patch !== "object") {
    return;
  }

  Object.entries(patch).forEach(([path, value]) => {
    setValueByPath(props.parts, path, value);
  });
}

function applyDesignPreset(groupId, preset) {
  if (!preset?.patch || typeof preset.patch !== "object") {
    return;
  }
  selectedGroupId.value = String(groupId || "");
  applyPatch(preset.patch);
  const nextMap = new Map(selectedPresetIdByGroup.value);
  nextMap.set(groupId, preset.id);
  selectedPresetIdByGroup.value = nextMap;
}

function onAddItem(payload) {
  if (!payload?.targetCollection) {
    return;
  }
  addItemToCollection(props.parts, payload.targetCollection, payload.item || {});
}

function onRemoveItem(payload) {
  if (!payload?.targetCollection) {
    return;
  }
  removeItemFromCollection(props.parts, payload.targetCollection, payload.matcher);
}

function hasValidationIssue(groupId) {
  return !getMeta(groupId).validation.isValid;
}

async function focusGroupById(groupId) {
  const normalizedGroupId = String(groupId || "").trim();
  if (!normalizedGroupId) {
    return;
  }
  if (!displayGroups.value.some((group) => group.id === normalizedGroupId)) {
    return;
  }

  selectedGroupId.value = normalizedGroupId;
  const nextCollapsed = new Set(collapsedGroupIds.value);
  nextCollapsed.delete(normalizedGroupId);
  collapsedGroupIds.value = nextCollapsed;

  await nextTick();
  const cards = panelRootRef.value?.querySelectorAll(".group-card");
  const target = Array.from(cards || []).find((item) => item?.dataset?.groupId === normalizedGroupId);
  target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

defineExpose({
  focusGroupById,
});
</script>

<template>
  <section ref="panelRootRef" class="control-panel panel">
    <header class="panel-header">
      <h2>{{ panelTitle }}</h2>
    </header>
    <div class="title-divider" aria-hidden="true"></div>

    <div class="group-list">
      <section
        v-for="group in displayGroups"
        :key="group.id"
        class="group-card"
        :data-group-id="group.id"
        :class="{ selected: isGroupSelected(group.id) }"
        @click="selectGroup(group.id)"
      >
        <header class="group-header">
          <h3>{{ group.label }}</h3>
          <div class="group-actions">
            <button
              type="button"
              class="group-toggle"
              @click.stop="toggleGroupCollapsed(group.id)"
            >
              {{ isGroupCollapsed(group.id) ? "Expand" : "Collapse" }}
            </button>
            <button
              type="button"
              class="group-delete"
              @click.stop="onRemoveGroup(group.id)"
            >
              Delete
            </button>
          </div>
        </header>

        <div v-if="hasValidationIssue(group.id)" class="fallback-warning">
          PanelSpec has invalid fields. Unsupported controls are skipped safely.
        </div>

        <div v-if="!isGroupCollapsed(group.id)" class="group-body">
          <section v-if="group.designPresets.length" class="design-presets-section">
            <header class="section-header">
              <h4>Design Presets</h4>
            </header>
            <div class="design-preset-grid">
              <button
                v-for="preset in group.designPresets"
                :key="`${group.id}_${preset.id}`"
                type="button"
                class="design-preset-card"
                :class="{ active: isDesignPresetSelected(group.id, preset.id) }"
                @click.stop="applyDesignPreset(group.id, preset)"
              >
                <div class="design-preset-thumb-wrap">
                  <img
                    v-if="preset.thumbnailDataUrl"
                    class="design-preset-thumb"
                    :src="preset.thumbnailDataUrl"
                    :alt="preset.label"
                  />
                  <div v-else class="design-preset-thumb-fallback">No Preview</div>
                </div>
                <span class="design-preset-label">{{ preset.label }}</span>
              </button>
            </div>
          </section>

          <section
            v-for="block in getRenderSectionBlocks(group)"
            :key="`${group.id}_${block.section.sectionId}`"
            class="spec-section"
            :class="{ highlighted: isBlockHighlighted(group, block) }"
          >
            <header class="section-header">
              <h4>{{ block.section.title }}</h4>
            </header>

            <div class="controls-list">
              <ControlRenderer
                v-for="control in block.section.controls"
                :key="control.id"
                :control="control"
                :parts="parts"
                :is-unsupported="isUnsupported(group.id, block.section.sectionId, control.id)"
                :is-detail-expanded="Boolean(control.detailSectionRef && getExpandedDetailSet(group.id).has(control.detailSectionRef))"
                @apply-patch="applyPatch"
                @add-item="onAddItem"
                @remove-item="onRemoveItem"
                @toggle-detail="(sectionId) => toggleDetailSection(group.id, sectionId)"
              />
            </div>

            <div
              v-for="detailSection in block.detailSections"
              :key="`${group.id}_${detailSection.sectionId}`"
              class="detail-section"
            >
              <header class="section-header detail-header">
                <h5>{{ detailSection.title }}</h5>
              </header>
              <div class="controls-list detail-controls">
                <ControlRenderer
                  v-for="control in detailSection.controls"
                  :key="control.id"
                  :control="control"
                  :parts="parts"
                  :is-unsupported="isUnsupported(group.id, detailSection.sectionId, control.id)"
                  :is-detail-expanded="Boolean(control.detailSectionRef && getExpandedDetailSet(group.id).has(control.detailSectionRef))"
                  @apply-patch="applyPatch"
                  @add-item="onAddItem"
                  @remove-item="onRemoveItem"
                  @toggle-detail="(sectionId) => toggleDetailSection(group.id, sectionId)"
                />
              </div>
            </div>
          </section>
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
}

.title-divider {
  margin-top: 8px;
  width: 100%;
  height: 1px;
  border-radius: 999px;
  background: #d8e0ea;
}

.group-list {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-card {
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
}

.group-card.selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.group-header h3 {
  margin: 0;
  font-size: 14px;
  color: #0f172a;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-toggle {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  padding: 4px 10px;
  width: 70px;
  text-align: center;
  cursor: pointer;
}

.group-delete {
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff1f2;
  color: #b91c1c;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
}

.group-body {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.design-presets-section {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  background: #f8fafc;
}

.design-preset-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.design-preset-card {
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  text-align: left;
}

.design-preset-card.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
}

.design-preset-thumb-wrap {
  width: 100%;
  aspect-ratio: 3 / 2;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  overflow: hidden;
  background: #ffffff;
}

.design-preset-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.design-preset-thumb-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 11px;
  color: #64748b;
}

.design-preset-label {
  font-size: 11px;
  color: #1e293b;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fallback-warning {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-size: 12px;
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

.section-header h4 {
  margin: 0;
  font-size: 13px;
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

.detail-header h5 {
  margin: 0;
  font-size: 12px;
  color: #1e3a8a;
}

.detail-controls {
  margin-top: 8px;
}
</style>
