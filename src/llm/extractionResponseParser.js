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
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = tryParse(content.slice(firstBrace, lastBrace + 1));
    if (parsed) {
      return parsed;
    }
  }

  return tryParse(content.trim());
}

export function parseExtractionResponse(rawText) {
  const parsed = extractJsonBlock(rawText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Extraction LLM response is not valid JSON object.");
  }
  return parsed;
}
