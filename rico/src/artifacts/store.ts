import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const METADATA_ROOT = "__rico_meta__";

export interface WriteArtifactInput {
  root: string;
  projectId: string;
  goalId: string;
  fileName: string;
  content: string;
}

export interface StoredArtifact {
  root: string;
  projectId: string;
  goalId: string;
  fileName: string;
  path: string;
  metadataPath: string;
  content: string;
}

function normalizeArtifactPath(
  input: string,
  fieldName: string,
  options: { allowNested?: boolean } = {},
) {
  const normalized = input.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`artifact ${fieldName} must not be empty`);
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`artifact ${fieldName} must stay within the artifact root`);
  }
  if (segments.some((segment) => segment === METADATA_ROOT)) {
    throw new Error(`artifact ${fieldName} uses a reserved path segment`);
  }
  if (!options.allowNested && segments.length > 1) {
    throw new Error(`artifact ${fieldName} must be a single path segment`);
  }

  return segments.join("/");
}

function artifactMetadataPath(
  root: string,
  projectId: string,
  goalId: string,
  fileName: string,
) {
  return join(
    root,
    METADATA_ROOT,
    normalizeArtifactPath(projectId, "projectId"),
    normalizeArtifactPath(goalId, "goalId"),
    `${normalizeArtifactPath(fileName, "fileName", { allowNested: true })}.json`,
  );
}

export function artifactPath(
  root: string,
  projectId: string,
  goalId: string,
  fileName: string,
) {
  return join(
    root,
    normalizeArtifactPath(projectId, "projectId"),
    normalizeArtifactPath(goalId, "goalId"),
    normalizeArtifactPath(fileName, "fileName", { allowNested: true }),
  );
}

export function writeArtifact(input: WriteArtifactInput): StoredArtifact {
  const path = artifactPath(
    input.root,
    input.projectId,
    input.goalId,
    input.fileName,
  );
  const metadataPath = artifactMetadataPath(
    input.root,
    input.projectId,
    input.goalId,
    input.fileName,
  );
  const metadata = {
    root: input.root,
    projectId: input.projectId,
    goalId: input.goalId,
    fileName: input.fileName,
    path,
    bytes: Buffer.byteLength(input.content, "utf8"),
  };

  mkdirSync(dirname(path), { recursive: true });
  mkdirSync(dirname(metadataPath), { recursive: true });
  writeFileSync(path, input.content, "utf8");
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

  return {
    root: input.root,
    projectId: input.projectId,
    goalId: input.goalId,
    fileName: input.fileName,
    path,
    metadataPath,
    content: input.content,
  };
}
