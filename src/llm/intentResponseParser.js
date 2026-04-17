function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractJsonBlock(text) {
  if (!text) {
    return null;
  }

  const fencedMatch = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    const parsed = tryParse(fencedMatch[1].trim());
    if (parsed) {
      return parsed;
    }
  }

  const content = String(text);
  const first = content.indexOf("{");
  const last = content.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const maybe = content.slice(first, last + 1);
    const parsed = tryParse(maybe);
    if (parsed) {
      return parsed;
    }
  }

  return tryParse(content.trim());
}

export function parseIntentResponse(rawText) {
  const parsed = extractJsonBlock(rawText);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM response is not valid JSON intent.");
  }
  return parsed;
}
