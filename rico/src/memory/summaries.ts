export function fitArtifactsToBudget(
  artifacts: Array<{ title: string; body: string }>,
  initialText: string,
  maxChars: number,
) {
  const selected: Array<{ title: string; body: string }> = [];
  let current = initialText;

  for (const artifact of artifacts) {
    const nextChunk = `${artifact.title}\n${artifact.body}`;
    const candidate = `${current}\n\n${nextChunk}`;
    if (candidate.length > maxChars) break;
    selected.push(artifact);
    current = candidate;
  }

  return selected;
}
