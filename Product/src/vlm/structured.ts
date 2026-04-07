/**
 * JSON extraction from VLM text responses.
 * Handles the common case where VLMs wrap JSON in markdown code blocks
 * or include preamble text before/after the JSON.
 */

export function extractJson<T = Record<string, unknown>>(text: string): T | null {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fall through
  }

  // Try extracting from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // Fall through
    }
  }

  // Try extracting the first JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  // Try extracting a JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  return null;
}

export function requireJson<T = Record<string, unknown>>(text: string, context?: string): T {
  const result = extractJson<T>(text);
  if (result === null) {
    const preview = text.slice(0, 200);
    throw new Error(
      `Failed to extract JSON from VLM response${context ? ` (${context})` : ""}. Preview: ${preview}`,
    );
  }
  return result;
}
