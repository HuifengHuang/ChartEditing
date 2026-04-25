// 将 `a.b[0].c` 这类路径统一拆分成可遍历的段数组。
function normalizePath(path) {
  if (typeof path !== "string") {
    return [];
  }

  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

// 判断路径段是否是数组索引（纯数字）。
function isNumericSegment(segment) {
  return /^\d+$/.test(segment);
}

// 按路径读取对象中的值，不存在时返回 `undefined`。
export function getValueByPath(obj, path) {
  const segments = normalizePath(path);
  let current = obj;

  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

// 按路径写入对象中的值，缺失中间节点时自动补齐对象/数组。
export function setValueByPath(obj, path, value) {
  const segments = normalizePath(path);
  if (!segments.length) {
    return obj;
  }

  let current = obj;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    // 下一段是数字时，当前段需要补数组；否则补对象。
    const shouldCreateArray = isNumericSegment(nextSegment);

    if (current[segment] == null || typeof current[segment] !== "object") {
      current[segment] = shouldCreateArray ? [] : {};
    }

    current = current[segment];
  }

  current[segments[segments.length - 1]] = value;
  return obj;
}
