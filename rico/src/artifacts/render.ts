export interface TextArtifactInput {
  fileName: string;
  title: string;
  body: unknown;
  format: "md" | "txt" | string;
}

export interface RenderedTextArtifact {
  fileName: string;
  content: string;
}

export function renderTextArtifact(
  input: TextArtifactInput,
): RenderedTextArtifact {
  const jsonContent =
    input.format === "json"
      ? JSON.stringify(
          typeof input.body === "string"
            ? { title: input.title, body: input.body }
            : input.body,
          null,
          2,
        )
      : null;
  if (input.format === "json" && typeof jsonContent !== "string") {
    throw new Error("json artifact body must be serializable");
  }

  const content =
    input.format === "json"
      ? `${jsonContent}\n`
      : input.format === "md"
        ? `# ${input.title}\n\n${String(input.body)}\n`
        : `${input.title}\n\n${String(input.body)}\n`;

  return {
    fileName: input.fileName,
    content,
  };
}
