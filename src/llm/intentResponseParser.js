// 尝试直接 JSON.parse，失败返回 null。
function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

// 从最外层括号区间提取 JSON（支持对象/数组）。
function extractByBrackets(text, openChar, closeChar) {
  const content = String(text || "");
  const first = content.indexOf(openChar);
  const last = content.lastIndexOf(closeChar);
  if (first >= 0 && last > first) {
    const maybe = content.slice(first, last + 1);
    const parsed = tryParse(maybe);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

// 从模型输出中提取 JSON：优先 fenced block，再尝试括号截取。
function extractJsonBlock(text) {
  if (!text) {
    return null;
  }
  const content = String(text);

  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    const parsed = tryParse(fencedMatch[1].trim());
    if (parsed) {
      return parsed;
    }
  }

  const arrayParsed = extractByBrackets(text, "[", "]");
  if (arrayParsed !== null) {
    return arrayParsed;
  }

  const objectParsed = extractByBrackets(text, "{", "}");
  if (objectParsed !== null) {
    return objectParsed;
  }

  return tryParse(content.trim());
}

// 解析意图响应：只接受对象形态的 JSON 负载。
export function parseIntentResponse(rawText) {
  const parsed = extractJsonBlock(rawText);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM response is not valid JSON intent payload.");
  }
  return parsed;
}
