function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
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

export function parseIntentResponse(rawText) {
  const parsed = extractJsonBlock(rawText);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM response is not valid JSON intent payload.");
  }
  return parsed;
}
