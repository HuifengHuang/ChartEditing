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

function isNumericSegment(segment) {
  return /^\d+$/.test(segment);
}

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

export function setValueByPath(obj, path, value) {
  const segments = normalizePath(path);
  if (!segments.length) {
    return obj;
  }

  let current = obj;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    const shouldCreateArray = isNumericSegment(nextSegment);

    if (current[segment] == null || typeof current[segment] !== "object") {
      current[segment] = shouldCreateArray ? [] : {};
    }

    current = current[segment];
  }

  current[segments[segments.length - 1]] = value;
  return obj;
}
