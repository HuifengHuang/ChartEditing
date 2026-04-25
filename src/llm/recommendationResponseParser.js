function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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

  const objectParsed = extractByBrackets(content, "{", "}");
  if (objectParsed !== null) {
    return objectParsed;
  }

  const arrayParsed = extractByBrackets(content, "[", "]");
  if (arrayParsed !== null) {
    return arrayParsed;
  }

  return tryParse(content.trim());
}

// 解析推荐模型返回，确保是 JSON 对象。
export function parseRecommendationResponse(rawText) {
  const parsed = extractJsonBlock(rawText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Recommendation response is not valid JSON object.");
  }
  return parsed;
}

