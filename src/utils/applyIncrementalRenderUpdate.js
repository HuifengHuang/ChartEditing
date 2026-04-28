import { getValueByPath, setValueByPath } from "./pathUtils.js";

const ALLOWED_SOURCE_OPS = new Set(["add"]);
const ALLOWED_RENDER_OPS = new Set(["insert_before", "insert_after"]);

// 安全深拷贝，防止直接修改响应式源对象。
function safeClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

// 统一 source_data 路径前缀，确保写入到 parts.source_data。
function normalizeSourcePath(path) {
  const text = String(path || "").trim();
  if (!text) {
    return "";
  }
  if (text === "source_data" || text.startsWith("source_data.")) {
    return text;
  }
  return `source_data.${text}`;
}

// 将 render_script 统一成字符串，便于按锚点插入代码。
function normalizeRenderScriptText(renderScript) {
  if (Array.isArray(renderScript)) {
    return renderScript.map((line) => String(line ?? "")).join("\n");
  }
  return String(renderScript || "");
}

// 找到 data.forEach 代码块范围，用于优先放置依赖 d 的增量代码。
function findForEachBlockRange(scriptText) {
  const start = scriptText.indexOf("data.forEach(");
  if (start < 0) {
    return null;
  }
  const end = scriptText.indexOf("\n});", start);
  if (end < 0) {
    return null;
  }
  return {
    start,
    end: end + 4,
  };
}

// 在脚本文本中查找所有锚点匹配（先全文精确匹配，再按行 trim 匹配）。
function findAnchorRanges(scriptText, anchorText) {
  const ranges = [];
  let from = 0;
  while (from < scriptText.length) {
    const index = scriptText.indexOf(anchorText, from);
    if (index < 0) {
      break;
    }
    ranges.push({
      start: index,
      end: index + anchorText.length,
    });
    from = index + anchorText.length;
  }
  if (ranges.length) {
    return ranges;
  }

  const anchorTrimmed = anchorText.trim();
  if (!anchorTrimmed) {
    return [];
  }

  const lineRanges = [];
  const lines = scriptText.split("\n");
  let cursor = 0;
  for (const line of lines) {
    const lineStart = cursor;
    const lineEnd = cursor + line.length;
    if (line.trim() === anchorTrimmed) {
      lineRanges.push({
        start: lineStart,
        end: lineEnd,
      });
    }
    cursor = lineEnd + 1;
  }
  return lineRanges;
}

// 解析锚点具体落点：重复锚点时按上下文选位，无法确定则报错防止误插。
function resolveAnchorRange(scriptText, anchorText, contentText) {
  const ranges = findAnchorRanges(scriptText, anchorText);
  if (!ranges.length) {
    return null;
  }
  if (ranges.length === 1) {
    return ranges[0];
  }

  const looksLikeLoopScoped =
    /\bd\./.test(contentText) ||
    /\bleftX\b/.test(contentText) ||
    /\brightWidth\b/.test(contentText) ||
    /\bwaitingArea\b/.test(contentText) ||
    /\bcorridor\b/.test(contentText);

  if (looksLikeLoopScoped) {
    const block = findForEachBlockRange(scriptText);
    if (block) {
      const inLoop = ranges.filter((range) => range.start >= block.start && range.end <= block.end);
      if (inLoop.length === 1) {
        return inLoop[0];
      }
      if (inLoop.length > 1) {
        return inLoop[inLoop.length - 1];
      }
    }
  }

  throw new Error(`Ambiguous render script anchor (matched ${ranges.length} times): ${anchorText}`);
}

// 把内容按 before/after 规则插入到锚点附近，同时处理换行边界。
function insertByAnchor(scriptText, { op, anchor, content }) {
  const range = resolveAnchorRange(scriptText, anchor, content);
  if (!range) {
    throw new Error(`Render script anchor not found: ${anchor}`);
  }

  const insertIndex = op === "insert_before" ? range.start : range.end;
  const before = scriptText.slice(0, insertIndex);
  const after = scriptText.slice(insertIndex);

  const normalizedContent = String(content || "");
  if (!normalizedContent.trim()) {
    return scriptText;
  }

  if (scriptText.includes(normalizedContent)) {
    return scriptText;
  }

  const prefix = before && !before.endsWith("\n") && !normalizedContent.startsWith("\n") ? "\n" : "";
  const suffix = after && !after.startsWith("\n") && !normalizedContent.endsWith("\n") ? "\n" : "";
  return `${before}${prefix}${normalizedContent}${suffix}${after}`;
}

// 执行 source_data 的 add 操作：若路径已存在则跳过，保证“只增不改”。
function applySourceAdd(nextParts, sourceOp, skippedOps) {
  if (!ALLOWED_SOURCE_OPS.has(sourceOp.op)) {
    throw new Error(`Invalid source_data op: ${sourceOp.op}`);
  }

  const path = normalizeSourcePath(sourceOp.path);
  if (!path) {
    throw new Error("source_data add op path is required.");
  }

  const existed = getValueByPath(nextParts, path);
  if (typeof existed !== "undefined") {
    skippedOps.push({
      ...sourceOp,
      reason: "path_exists",
    });
    return;
  }

  setValueByPath(nextParts, path, safeClone(sourceOp.value));
}

// 执行 render_script 插入操作，禁止 replace/remove 类行为。
function applyRenderInsert(currentScript, renderOp) {
  if (!ALLOWED_RENDER_OPS.has(renderOp.op)) {
    throw new Error(`Invalid render_script op: ${renderOp.op}`);
  }

  const anchor = String(renderOp.anchor || "").trim();
  if (!anchor) {
    throw new Error("render_script op anchor is required.");
  }

  return insertByAnchor(currentScript, {
    op: renderOp.op,
    anchor,
    content: String(renderOp.content || ""),
  });
}

// 应用“增量更新计划”到 chart parts：只新增 source_data 字段，只插入 render_script 代码。
export function applyIncrementalRenderUpdate(parts, incrementalJson) {
  const nextParts = safeClone(parts || {});
  const payload =
    incrementalJson && typeof incrementalJson === "object" && !Array.isArray(incrementalJson)
      ? incrementalJson
      : {};

  const sourceDataOps = Array.isArray(payload.source_data_ops) ? payload.source_data_ops : [];
  const renderScriptOps = Array.isArray(payload.render_script_ops) ? payload.render_script_ops : [];

  const skippedSourceOps = [];
  sourceDataOps.forEach((op) => applySourceAdd(nextParts, op || {}, skippedSourceOps));

  let nextRenderScript = normalizeRenderScriptText(nextParts?.html_template?.render_script);
  renderScriptOps.forEach((op) => {
    nextRenderScript = applyRenderInsert(nextRenderScript, op || {});
  });

  if (!nextParts.html_template || typeof nextParts.html_template !== "object") {
    nextParts.html_template = {};
  }
  nextParts.html_template.render_script = nextRenderScript;

  return {
    parts: nextParts,
    summary: {
      source_add_requested: sourceDataOps.length,
      source_add_skipped: skippedSourceOps.length,
      source_add_applied: sourceDataOps.length - skippedSourceOps.length,
      render_insert_applied: renderScriptOps.length,
      skipped_source_ops: skippedSourceOps,
    },
  };
}
