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
});

const expandedDetailSections = ref(new Set());

const validationResult = computed(() => validatePanelSpec(props.panelSpec));
const unsupportedControlKeys = computed(() => getUnsupportedControlKeySet(validationResult.value.issues));
const sectionMap = computed(() => {
  const map = new Map();
  (props.panelSpec.sections || []).forEach((section) => {
    map.set(section.sectionId, section);
  });
  return map;
});

watch(
  validationResult,
  (result) => {
    if (!result.issues.length) {
      return;
    }
    result.issues.forEach((issue) => {
      const location = [issue.sectionId, issue.controlId].filter(Boolean).join(" / ");
      const prefix = location ? `[PanelSpec] ${location}:` : "[PanelSpec]";
      if (issue.level === "error") {
        console.warn(`${prefix} ${issue.message}`);
      } else {
        console.warn(`${prefix} ${issue.message}`);
      }
    });
  },
  { immediate: true }
);

watch(
  () => [props.panelSpec.sections, props.panelSpec.uiState?.expandedSections],
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

const visibleSections = computed(() =>
  (props.panelSpec.sections || []).filter((section) => {
    if (section.priority !== "detail") {
      return true;
    }
    return expandedDetailSections.value.has(section.sectionId);
  })
);

function applyPatch(patch) {
  if (!patch || typeof patch !== "object") {
    return;
  }

  Object.entries(patch).forEach(([path, value]) => {
    setValueByPath(props.parts, path, value);
  });
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

function isUnsupported(sectionId, controlId) {
  return unsupportedControlKeys.value.has(`${sectionId}::${controlId}`);
}

function isHighlighted(sectionId) {
  return props.panelSpec?.uiState?.highlightedSectionId === sectionId;
}
</script>

<template>
  <section class="control-panel panel">
    <header class="panel-header">
      <h2>{{ panelSpec.title }}</h2>
    </header>

    <div v-if="!validationResult.isValid" class="fallback-warning">
      PanelSpec has invalid fields. Unsupported controls are skipped safely.
    </div>

    <div class="section-list">
      <section
        v-for="section in visibleSections"
        :key="section.sectionId"
        class="spec-section"
        :class="{ highlighted: isHighlighted(section.sectionId) }"
      >
        <header class="section-header">
          <h3>{{ section.title }}</h3>
        </header>

        <div class="controls-list">
          <ControlRenderer
            v-for="control in section.controls"
            :key="control.id"
            :control="control"
            :parts="parts"
            :is-unsupported="isUnsupported(section.sectionId, control.id)"
            :is-detail-expanded="Boolean(control.detailSectionRef && expandedDetailSections.has(control.detailSectionRef))"
            @apply-patch="applyPatch"
            @add-item="onAddItem"
            @remove-item="onRemoveItem"
            @toggle-detail="toggleDetailSection"
          />
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
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
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
</style>
